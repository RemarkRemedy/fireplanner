import { useMemo } from 'react'
import { computeHealthRatios, type HealthCheckResult } from '@/lib/calculations/healthCheck'
import { useHealthCheckInputs } from './useHealthCheckInputs'

export function useHealthCheck(adultId?: string): {
  result: HealthCheckResult | null
  adultName: string
  isReady: boolean
} {
  const inputs = useHealthCheckInputs(adultId)

  const result = useMemo(() => {
    if (!inputs) return null
    return computeHealthRatios(inputs.ratioInputs)
  }, [inputs])

  return {
    result,
    adultName: inputs?.adultName ?? '',
    isReady: inputs?.isReady ?? false,
  }
}
