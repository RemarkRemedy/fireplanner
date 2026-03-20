/** Gradient palette for each Wrapped story card. Dark hex gradients for WCAG AA contrast with white text. */
export const WRAPPED_GRADIENTS = {
  intro: 'linear-gradient(to bottom right, #0F0F1A, #1A1040)',
  netWorth: 'linear-gradient(to bottom right, #1A1040, #2D1B69)',
  fireNumber: 'linear-gradient(to bottom right, #2D1B69, #4A1060)',
  progress: 'linear-gradient(to bottom right, #4A1060, #6B1030)',
  savingsPower: 'linear-gradient(to bottom right, #3B1060, #5A1040)',
  milestone: 'linear-gradient(to bottom right, #6B1030, #7C2400)',
  trajectory: 'linear-gradient(to bottom right, #7C2400, #5C3D00)',
  peak: 'linear-gradient(to bottom right, #1A3A2A, #0D2B1F)',
  summary: 'linear-gradient(to bottom right, #0F1729, #0A0F1E)',
} as const

export type WrappedCardKey = keyof typeof WRAPPED_GRADIENTS

/** Card metadata for building the story sequence */
export interface WrappedCardConfig {
  key: WrappedCardKey
  gradient: string
}

/** Build the ordered card sequence. Individual = 8 cards, couple = 8 (swaps peak for savingsPower).
 * Peak is excluded from couple mode because the data source (useDashboardCharts) runs a
 * single-person model that doesn't reflect the full household projection. */
export function buildCardSequence(mode: 'individual' | 'couple' = 'individual'): WrappedCardConfig[] {
  const keys: WrappedCardKey[] = mode === 'couple'
    ? ['intro', 'netWorth', 'fireNumber', 'savingsPower', 'progress', 'milestone', 'trajectory', 'summary']
    : ['intro', 'netWorth', 'fireNumber', 'progress', 'milestone', 'trajectory', 'peak', 'summary']
  return keys.map((key) => ({ key, gradient: WRAPPED_GRADIENTS[key] }))
}
