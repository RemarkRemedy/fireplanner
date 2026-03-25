import { useMemo } from 'react'
import type { IlpFullAnalysis, IlpPolicyInput } from '@/lib/calculations/ilp'
import { analyzeAllPolicies } from '@/lib/calculations/ilp'
import { ilpPolicySchema } from '@/lib/validation/ilpSchema'
import { useIlpStore } from '@/stores/useIlpStore'

interface IlpAnalysisResult {
  analysis: IlpFullAnalysis | null
  error: string | null
  validPolicies: IlpPolicyInput[]
  excludedCount: number
}

/**
 * Centralized hook for ILP policy analysis. Reads policies from the ILP store,
 * validates them, and runs analyzeAllPolicies with memoization.
 *
 * Shared by IlpReviewPage and IlpStoryMode to avoid redundant recomputation.
 */
export function useIlpAnalysis(): IlpAnalysisResult {
  const policies = useIlpStore((state) => state.policies)

  return useMemo(() => {
    const validPolicies = policies.filter((policy) => ilpPolicySchema.safeParse(policy).success)
    const excludedCount = policies.length - validPolicies.length

    if (validPolicies.length === 0) {
      return { analysis: null, error: null, validPolicies: [], excludedCount }
    }

    try {
      return {
        analysis: analyzeAllPolicies(validPolicies),
        error: null,
        validPolicies,
        excludedCount,
      }
    } catch (error) {
      return {
        analysis: null,
        error: error instanceof Error ? error.message : 'Unable to analyze ILP policies.',
        validPolicies,
        excludedCount,
      }
    }
  }, [policies])
}
