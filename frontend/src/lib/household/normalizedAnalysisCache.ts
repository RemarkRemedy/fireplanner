export type HouseholdRevision = string
type LegacyRevisionFragment = string | number

export interface LegacyAuthoringRevisions {
  profileRevision: LegacyRevisionFragment
  incomeRevision: LegacyRevisionFragment
  propertyRevision: LegacyRevisionFragment
}

export interface GlobalPlannerInputRevisions {
  allocationRevision: number
  simulationRevision: number
  withdrawalRevision: number
}

export interface NormalizedAnalysisCacheKeyParts {
  householdRevision: HouseholdRevision
  scenarioOverrideHash: string
}

export const MONTE_CARLO_NORMALIZED_OWNER = 'PR4B' as const
export const MONTE_CARLO_RUN_SIGNATURE_VERSION = 'mc-v1'

export function buildLegacyHouseholdRevision(
  revisions: LegacyAuthoringRevisions
): HouseholdRevision {
  return `legacy:${revisions.profileRevision}:${revisions.incomeRevision}:${revisions.propertyRevision}`
}

export function buildHouseholdPlanRevision(
  householdPlanRevision: number
): HouseholdRevision {
  return `household:${householdPlanRevision}`
}

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeForHash(entry))
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = canonicalizeForHash((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

function hashCanonicalValue(value: unknown): string {
  return fnv1aHash(JSON.stringify(canonicalizeForHash(value)))
}

export function stableRevisionHash(value: unknown): string {
  return hashCanonicalValue(value)
}

export function stableScenarioOverrideHash(overrides: unknown): string {
  return hashCanonicalValue(overrides ?? null)
}

export function stableRunOverrideHash(overrides: unknown): string {
  return hashCanonicalValue(overrides ?? null)
}

export function buildNormalizedAnalysisCacheKey(
  parts: NormalizedAnalysisCacheKeyParts
): string {
  return `${parts.householdRevision}::${parts.scenarioOverrideHash}`
}

export interface MonteCarloRunSignatureInput
  extends GlobalPlannerInputRevisions,
    NormalizedAnalysisCacheKeyParts {
  runOverrideHash: string
}

export function buildMonteCarloRunSignature(
  input: MonteCarloRunSignatureInput
): string {
  return [
    MONTE_CARLO_RUN_SIGNATURE_VERSION,
    input.householdRevision,
    input.scenarioOverrideHash,
    `a${input.allocationRevision}`,
    `s${input.simulationRevision}`,
    `w${input.withdrawalRevision}`,
    input.runOverrideHash,
  ].join(':')
}
