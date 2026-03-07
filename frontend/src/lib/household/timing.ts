import type {
  AdultOwner,
  PlanningAdult,
  TimingRule,
} from './types'

export type TimingWarningCode =
  | 'invalid-timing-range'
  | 'missing-owner'
  | 'timing-after-life-expectancy'
  | 'timing-before-current-age'

export interface TimingWarning {
  code: TimingWarningCode
  message: string
  path?: string
}

export interface ResolvedTimingWindow {
  owner: AdultOwner
  adultId: string
  startAge: number
  endAge: number
  startYearOffset: number
  endYearOffset: number
}

export interface TimingResolutionResult {
  window: ResolvedTimingWindow | null
  warnings: TimingWarning[]
}

export interface AdultTimingOffsets {
  adultId: string
  owner: AdultOwner
  currentAge: number
  currentYearOffset: 0
  retirementAge: number
  retirementYearOffset: number
  lifeExpectancyAge: number
  lifeExpectancyYearOffset: number
  cpfLifeStartAge: number
  cpfLifeYearOffset: number
  alreadyRetired: boolean
  cpfLifeStarted: boolean
}

export type AdultsByOwner = Partial<Record<AdultOwner, PlanningAdult>>

function clampYearOffset(rawOffset: number, maxOffset: number): number {
  return Math.max(0, Math.min(maxOffset, rawOffset))
}

export function buildAdultsByOwner(adults: readonly PlanningAdult[]): AdultsByOwner {
  const byOwner: AdultsByOwner = {}

  for (const adult of adults) {
    if (!(adult.owner in byOwner)) {
      byOwner[adult.owner] = adult
    }
  }

  return byOwner
}

export function resolveAdultTimingOffsets(adult: PlanningAdult): AdultTimingOffsets {
  const lifeExpectancyYearOffset = Math.max(0, adult.lifeExpectancy - adult.currentAge)

  return {
    adultId: adult.id,
    owner: adult.owner,
    currentAge: adult.currentAge,
    currentYearOffset: 0,
    retirementAge: adult.retirementAge,
    retirementYearOffset: clampYearOffset(
      adult.retirementAge - adult.currentAge,
      lifeExpectancyYearOffset
    ),
    lifeExpectancyAge: adult.lifeExpectancy,
    lifeExpectancyYearOffset,
    cpfLifeStartAge: adult.cpf.lifeStartAge,
    cpfLifeYearOffset: clampYearOffset(
      adult.cpf.lifeStartAge - adult.currentAge,
      lifeExpectancyYearOffset
    ),
    alreadyRetired: adult.retirementAge <= adult.currentAge,
    cpfLifeStarted: adult.cpf.lifeStartAge <= adult.currentAge,
  }
}

export function resolveTimingRule(
  timing: TimingRule,
  adultsByOwner: AdultsByOwner,
  path?: string
): TimingResolutionResult {
  const adult = adultsByOwner[timing.owner]

  if (!adult) {
    return {
      window: null,
      warnings: [{
        code: 'missing-owner',
        path,
        message: `Cannot resolve ${path ?? 'timing'} because the ${timing.owner} adult is missing.`,
      }],
    }
  }

  const warnings: TimingWarning[] = []
  const lifeExpectancyYearOffset = Math.max(0, adult.lifeExpectancy - adult.currentAge)

  const startAge = timing.kind === 'single-age' ? timing.age : timing.startAge
  const rawEndAge = timing.kind === 'single-age'
    ? timing.age
    : (timing.endAge ?? adult.lifeExpectancy)

  if (rawEndAge < startAge) {
    return {
      window: null,
      warnings: [{
        code: 'invalid-timing-range',
        path,
        message: `Cannot resolve ${path ?? 'timing'} because its end age precedes its start age.`,
      }],
    }
  }

  if (rawEndAge < adult.currentAge) {
    return {
      window: null,
      warnings: [{
        code: 'timing-before-current-age',
        path,
        message: `${path ?? 'timing'} falls entirely before the ${timing.owner} adult's current age.`,
      }],
    }
  }

  if (startAge > adult.lifeExpectancy) {
    return {
      window: null,
      warnings: [{
        code: 'timing-after-life-expectancy',
        path,
        message: `${path ?? 'timing'} starts after the ${timing.owner} adult's life expectancy.`,
      }],
    }
  }

  let startYearOffset = startAge - adult.currentAge
  let endYearOffset = rawEndAge - adult.currentAge

  if (startYearOffset < 0) {
    warnings.push({
      code: 'timing-before-current-age',
      path,
      message: `${path ?? 'timing'} starts before the ${timing.owner} adult's current age; clamping to year 0.`,
    })
    startYearOffset = 0
  }

  if (endYearOffset > lifeExpectancyYearOffset) {
    warnings.push({
      code: 'timing-after-life-expectancy',
      path,
      message: `${path ?? 'timing'} ends after the ${timing.owner} adult's life expectancy; clamping to the planning horizon.`,
    })
    endYearOffset = lifeExpectancyYearOffset
  }

  if (startYearOffset > endYearOffset) {
    return {
      window: null,
      warnings: warnings.length > 0
        ? warnings
        : [{
            code: 'invalid-timing-range',
            path,
            message: `Cannot resolve ${path ?? 'timing'} after applying horizon clamps.`,
          }],
    }
  }

  return {
    window: {
      owner: timing.owner,
      adultId: adult.id,
      startAge: adult.currentAge + startYearOffset,
      endAge: adult.currentAge + endYearOffset,
      startYearOffset,
      endYearOffset,
    },
    warnings,
  }
}

export function isYearOffsetActive(
  yearOffset: number,
  window: ResolvedTimingWindow | null | undefined
): boolean {
  if (!window) return false
  return yearOffset >= window.startYearOffset && yearOffset <= window.endYearOffset
}
