/** Gradient palette for each Wrapped story card. Dark gradients with white text. */
export const WRAPPED_GRADIENTS = {
  intro: 'from-slate-900 via-indigo-950 to-indigo-900',
  netWorth: 'from-indigo-900 via-purple-900 to-purple-800',
  fireNumber: 'from-purple-800 via-fuchsia-900 to-fuchsia-800',
  progress: 'from-fuchsia-800 via-rose-800 to-rose-700',
  milestone: 'from-rose-700 via-orange-700 to-orange-600',
  trajectory: 'from-orange-600 via-amber-600 to-amber-500',
  peak: 'from-amber-500 via-emerald-600 to-emerald-700',
  summary: 'from-violet-800 via-indigo-800 to-slate-900',
} as const

export type WrappedCardKey = keyof typeof WRAPPED_GRADIENTS

/** Card metadata for building the story sequence */
export interface WrappedCardConfig {
  key: WrappedCardKey
  gradient: string
}

/** Build the ordered 8-card sequence. */
export function buildCardSequence(): WrappedCardConfig[] {
  const keys: WrappedCardKey[] = [
    'intro',
    'netWorth',
    'fireNumber',
    'progress',
    'milestone',
    'trajectory',
    'peak',
    'summary',
  ]
  return keys.map((key) => ({ key, gradient: WRAPPED_GRADIENTS[key] }))
}
