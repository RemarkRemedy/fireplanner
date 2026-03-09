import type { AllocationState, GlidePathConfig, ProfileState } from '@/lib/types'
import { calculatePortfolioReturn, getEffectiveReturns, interpolateGlidePath } from '@/lib/calculations/portfolio'

type DeterministicProfileInputs = Pick<ProfileState, 'expectedReturn' | 'retirementAge' | 'usePortfolioReturn'>
type DeterministicAllocationInputs = Pick<
  AllocationState,
  'currentWeights' | 'targetWeights' | 'glidePathConfig' | 'returnOverrides' | 'validationErrors'
>
type DeterministicOptions = { retirementAge?: number }

export function getRetirementAgeWeights(
  glidePathEnabled: boolean,
  glidePathConfig: GlidePathConfig,
  currentWeights: number[],
  targetWeights: number[],
  retirementAge: number,
): number[] {
  if (!glidePathEnabled) return currentWeights

  const { startAge, endAge, method } = glidePathConfig
  if (retirementAge < startAge) return currentWeights
  if (retirementAge >= endAge) return targetWeights

  const duration = endAge - startAge
  if (duration <= 0) return currentWeights

  const progress = (retirementAge - startAge) / duration
  return interpolateGlidePath(currentWeights, targetWeights, progress, method)
}

export function resolveDeterministicExpectedReturn(
  profile: DeterministicProfileInputs,
  allocation: DeterministicAllocationInputs,
  options?: DeterministicOptions,
): number {
  if (!profile.usePortfolioReturn || Object.keys(allocation.validationErrors).length > 0) {
    return profile.expectedReturn
  }

  const overrideAge = options?.retirementAge
  const fallbackAge = Number.isFinite(profile.retirementAge) ? profile.retirementAge : 65
  const retirementAge = (overrideAge != null && Number.isFinite(overrideAge))
    ? overrideAge
    : fallbackAge

  const retirementWeights = getRetirementAgeWeights(
    allocation.glidePathConfig.enabled,
    allocation.glidePathConfig,
    allocation.currentWeights,
    allocation.targetWeights,
    retirementAge,
  )

  return calculatePortfolioReturn(retirementWeights, getEffectiveReturns(allocation.returnOverrides))
}
