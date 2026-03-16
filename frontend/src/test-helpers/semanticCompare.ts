import { expect } from 'vitest'

export interface SemanticToleranceProfile {
  currencyDecimals: number
  rateDecimals: number
}

export const DEFAULT_SEMANTIC_TOLERANCES: SemanticToleranceProfile = {
  currencyDecimals: 2,
  rateDecimals: 6,
}

function classifyNumericPath(path: string): 'integer' | 'rate' | 'currency' {
  if (/(^|\.)(age|year|yearsToFire|totalFailures|total_periods|successful_periods|failed_periods|worst_start_year|best_start_year|start_year|end_year|count|counts5y)(\.|$)/i.test(path)) {
    return 'integer'
  }

  if (/(^|\.)(progress|allocationWeights|successRate|normalSuccessRate|crisisSuccessRate|successDegradation|successImprovement|swr|blendRatio|portfolioReturnPct|rate|return|returns|stdDev|weights)(\.|$)/i.test(path)) {
    return 'rate'
  }

  return 'currency'
}

function normalizeNumber(
  value: number,
  category: ReturnType<typeof classifyNumericPath>,
  tolerances: SemanticToleranceProfile,
): number {
  if (category === 'integer') {
    return Math.round(value)
  }

  if (category === 'rate') {
    return Number(value.toFixed(tolerances.rateDecimals))
  }

  return Number(value.toFixed(tolerances.currencyDecimals))
}

export function expectSemanticClose(
  actual: unknown,
  expected: unknown,
  tolerances: SemanticToleranceProfile = DEFAULT_SEMANTIC_TOLERANCES,
  path = 'root',
) {
  if (actual === null || expected === null || actual === undefined || expected === undefined) {
    expect(actual, path).toEqual(expected)
    return
  }

  if (typeof actual === 'number' && typeof expected === 'number') {
    const category = classifyNumericPath(path)
    expect(
      normalizeNumber(actual, category, tolerances),
      path,
    ).toBe(normalizeNumber(expected, category, tolerances))
    return
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    expect(actual.length, `${path}.length`).toBe(expected.length)
    actual.forEach((entry, index) => {
      expectSemanticClose(entry, expected[index], tolerances, `${path}[${index}]`)
    })
    return
  }

  if (typeof actual === 'object' && typeof expected === 'object') {
    const actualRecord = actual as Record<string, unknown>
    const expectedRecord = expected as Record<string, unknown>
    expect(Object.keys(actualRecord).sort(), `${path}.keys`).toEqual(Object.keys(expectedRecord).sort())
    for (const key of Object.keys(actualRecord)) {
      expectSemanticClose(actualRecord[key], expectedRecord[key], tolerances, `${path}.${key}`)
    }
    return
  }

  expect(actual, path).toEqual(expected)
}
