/** Gradient palette for each Wrapped story card. Dark hex gradients for WCAG AA contrast with white text. */
export const WRAPPED_GRADIENTS = {
  intro: 'linear-gradient(to bottom right, #0F0F1A, #1A1040)',
  netWorth: 'linear-gradient(to bottom right, #1A1040, #2D1B69)',
  fireNumber: 'linear-gradient(to bottom right, #2D1B69, #4A1060)',
  progress: 'linear-gradient(to bottom right, #4A1060, #6B1030)',
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
