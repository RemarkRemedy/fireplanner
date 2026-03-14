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

export function computeDelta(
  before: MetricsSnapshot,
  after: MetricsSnapshot,
  label: string,
  explanation: string
): DeltaSummary {
  const deltas: DeltaSummary['deltas'] = []

  if (before.fireAge !== null && after.fireAge !== null) {
    const diff = after.fireAge - before.fireAge
    deltas.push({
      metric: 'FIRE age',
      before: before.fireAge,
      after: after.fireAge,
      formatted: diff === 0
        ? 'No change'
        : diff < 0
          ? `${Math.abs(diff)} year${Math.abs(diff) !== 1 ? 's' : ''} earlier`
          : `${diff} year${diff !== 1 ? 's' : ''} later`,
    })
  }

  if (before.fireNumber !== null && after.fireNumber !== null) {
    const diff = after.fireNumber - before.fireNumber
    const sign = diff >= 0 ? '+' : '-'
    deltas.push({
      metric: 'FIRE number',
      before: before.fireNumber,
      after: after.fireNumber,
      formatted: `${sign}$${Math.abs(diff).toLocaleString()}`,
    })
  }

  const isSignificant = deltas.some(d => d.before !== d.after)

  return { label, deltas, explanation, isSignificant }
}
