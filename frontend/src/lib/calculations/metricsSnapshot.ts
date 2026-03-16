export interface MetricsSnapshot {
  fireAge: number | null
  fireNumber: number | null
}

export interface DeltaSummary {
  label: string
  deltas: Array<{
    metric: string
    before: number
    after: number
    formatted: string
  }>
  explanation: string
  isSignificant: boolean
}

/** Normalize a snapshot value: round to integer, convert non-finite to null */
function normalize(value: number | null): number | null {
  if (value === null || !isFinite(value)) return null
  return Math.round(value)
}

export function computeDelta(
  before: MetricsSnapshot,
  after: MetricsSnapshot,
  label: string,
  explanation: string
): DeltaSummary {
  const deltas: DeltaSummary['deltas'] = []

  const bAge = normalize(before.fireAge)
  const aAge = normalize(after.fireAge)

  if (bAge !== null && aAge !== null) {
    const diff = aAge - bAge
    deltas.push({
      metric: 'FIRE age',
      before: bAge,
      after: aAge,
      formatted: diff === 0
        ? 'No change'
        : diff < 0
          ? `${Math.abs(diff)} year${Math.abs(diff) !== 1 ? 's' : ''} earlier`
          : `${diff} year${diff !== 1 ? 's' : ''} later`,
    })
  }

  const bNum = normalize(before.fireNumber)
  const aNum = normalize(after.fireNumber)

  if (bNum !== null && aNum !== null) {
    const diff = aNum - bNum
    const sign = diff >= 0 ? '+' : '-'
    deltas.push({
      metric: 'FIRE number',
      before: bNum,
      after: aNum,
      formatted: `${sign}$${Math.abs(diff).toLocaleString()}`,
    })
  }

  const isSignificant = deltas.some(d => d.before !== d.after)

  return { label, deltas, explanation, isSignificant }
}
