import { useMemo } from 'react'
import { computeInsuranceNeeds, type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { useHealthCheckInputs } from './useHealthCheckInputs'

export function useInsuranceNeeds(adultId?: string): {
  result: InsuranceNeedsResult | null
  adultName: string
  isReady: boolean
} {
  const inputs = useHealthCheckInputs(adultId)

  const result = useMemo(() => {
    if (!inputs) return null
    return computeInsuranceNeeds(inputs.insuranceInputs)
  }, [inputs])

  return {
    result,
    adultName: inputs?.adultName ?? '',
    isReady: inputs?.isReady ?? false,
  }
}
