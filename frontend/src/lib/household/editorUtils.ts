import type {
  AdultOwner,
  EntryOwner,
  HouseholdPlan,
  PlanningAdult,
  TimingRule,
} from '@/lib/household/types'

export type AgeRangeTiming = Extract<TimingRule, { kind: 'age-range' }>

export function ownerLabel(owner: AdultOwner): string {
  return owner === 'self' ? 'Self' : 'Partner'
}

export function entryOwnerLabel(owner: EntryOwner): string {
  return owner === 'shared' ? 'Shared' : ownerLabel(owner)
}

export function getSelectedAdult(
  plan: Pick<HouseholdPlan, 'adults'>,
  selectedAdultId?: string | null,
): PlanningAdult | null {
  return plan.adults.find((adult) => adult.id === selectedAdultId)
    ?? plan.adults.find((adult) => adult.owner === 'self')
    ?? plan.adults[0]
    ?? null
}

export function ensureAgeRangeTiming(
  timing: TimingRule | null,
  owner: AdultOwner,
  defaultStartAge: number,
  defaultEndAge = defaultStartAge,
): AgeRangeTiming {
  if (timing?.kind === 'age-range') {
    return timing
  }

  if (timing?.kind === 'single-age') {
    return {
      kind: 'age-range',
      owner: timing.owner,
      startAge: timing.age,
      endAge: timing.age,
    }
  }

  return {
    kind: 'age-range',
    owner,
    startAge: defaultStartAge,
    endAge: defaultEndAge,
  }
}

export function getTimingDurationYears(
  timing: AgeRangeTiming,
  fallbackDurationYears = 1,
): number {
  if (timing.endAge === null) {
    return fallbackDurationYears
  }

  return Math.max(1, timing.endAge - timing.startAge + 1)
}

export function syncTimingDuration(
  timing: AgeRangeTiming,
  updates: {
    startAge?: number
    durationYears?: number
  },
  maxEndAge?: number,
): { timing: AgeRangeTiming; durationYears: number } {
  const startAge = updates.startAge ?? timing.startAge
  const requestedDurationYears = Math.max(
    1,
    updates.durationYears ?? getTimingDurationYears(timing),
  )
  const unclampedEndAge = startAge + requestedDurationYears - 1
  const endAge = maxEndAge === undefined
    ? unclampedEndAge
    : Math.min(unclampedEndAge, maxEndAge)

  return {
    timing: {
      ...timing,
      startAge,
      endAge,
    },
    durationYears: Math.max(1, endAge - startAge + 1),
  }
}
