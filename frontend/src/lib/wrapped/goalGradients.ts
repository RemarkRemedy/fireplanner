/** Gradient palette for each goal calculator story card. Dark hex colors for WCAG AA contrast with white text. */
export const GOAL_GRADIENTS = {
  costReveal: '#1a1a2e',       // deep navy
  cpfOffset: '#16213e',        // dark blue
  grant: '#0f3460',            // ocean blue
  monthlySavings: '#1b2838',   // charcoal blue
  freedomAge: '#2d1b69',       // deep purple
  peerBenchmark: '#1a3c34',    // forest green
  taxHeadsUp: '#3d1c02',       // dark amber
  parkingTip: '#1c2e1c',       // dark green
  loanCheck: '#2e1c1c',        // dark red
  cta: '#1a1a1a',              // near black
} as const

export type GoalCardKey = keyof typeof GOAL_GRADIENTS

/** Card metadata for building the goal story sequence */
export interface GoalCardConfig {
  key: GoalCardKey
  goalId?: string        // which goal this card belongs to (undefined for shared cards)
  gradient: string       // hex color from GOAL_GRADIENTS
}

const MAX_CARDS = 15

/** Build the ordered card sequence for goal calculator stories.
 *  - 1 goal: per-goal cards + shared insight cards (~4-6 cards)
 *  - 2+ goals: per-goal cards (costReveal, monthlySavings) + shared cards
 *  - Always includes: costReveal per goal, monthlySavings per goal, freedomAge, cta
 *  - CTA is always last, hard cap at 15 cards */
export function buildGoalCardSequence(
  goalCount: number,
  hasPropertyGoal: boolean,
  _isCoupleMode: boolean,
): GoalCardConfig[] {
  const cards: GoalCardConfig[] = []

  if (goalCount <= 0) {
    return [{ key: 'cta', gradient: GOAL_GRADIENTS.cta }]
  }

  if (goalCount === 1) {
    // Single goal: linear story flow
    cards.push({ key: 'costReveal', goalId: 'goal-0', gradient: GOAL_GRADIENTS.costReveal })

    if (hasPropertyGoal) {
      cards.push({ key: 'cpfOffset', goalId: 'goal-0', gradient: GOAL_GRADIENTS.cpfOffset })
      cards.push({ key: 'grant', goalId: 'goal-0', gradient: GOAL_GRADIENTS.grant })
      cards.push({ key: 'loanCheck', goalId: 'goal-0', gradient: GOAL_GRADIENTS.loanCheck })
    }

    cards.push({ key: 'monthlySavings', goalId: 'goal-0', gradient: GOAL_GRADIENTS.monthlySavings })
    cards.push({ key: 'freedomAge', gradient: GOAL_GRADIENTS.freedomAge })
    cards.push({ key: 'peerBenchmark', gradient: GOAL_GRADIENTS.peerBenchmark })
  } else {
    // Multi-goal: per-goal cards then shared insights
    for (let i = 0; i < goalCount; i++) {
      const goalId = `goal-${i}`
      cards.push({ key: 'costReveal', goalId, gradient: GOAL_GRADIENTS.costReveal })
      cards.push({ key: 'monthlySavings', goalId, gradient: GOAL_GRADIENTS.monthlySavings })
    }

    if (hasPropertyGoal) {
      cards.push({ key: 'cpfOffset', gradient: GOAL_GRADIENTS.cpfOffset })
      cards.push({ key: 'grant', gradient: GOAL_GRADIENTS.grant })
      cards.push({ key: 'loanCheck', gradient: GOAL_GRADIENTS.loanCheck })
    }

    cards.push({ key: 'freedomAge', gradient: GOAL_GRADIENTS.freedomAge })
    cards.push({ key: 'peerBenchmark', gradient: GOAL_GRADIENTS.peerBenchmark })
  }

  // Conditional insight cards (shared across goals)
  cards.push({ key: 'taxHeadsUp', gradient: GOAL_GRADIENTS.taxHeadsUp })
  cards.push({ key: 'parkingTip', gradient: GOAL_GRADIENTS.parkingTip })

  // CTA is always last
  cards.push({ key: 'cta', gradient: GOAL_GRADIENTS.cta })

  // Hard cap at MAX_CARDS, but CTA must remain last
  if (cards.length > MAX_CARDS) {
    const trimmed = cards.slice(0, MAX_CARDS - 1)
    trimmed.push({ key: 'cta', gradient: GOAL_GRADIENTS.cta })
    return trimmed
  }

  return cards
}
