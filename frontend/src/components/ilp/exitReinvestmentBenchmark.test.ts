import { describe, expect, it } from 'vitest'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'
import { analyzeIlpPolicy } from '@/lib/calculations/ilp'
import { mergePolicySeed } from '@/stores/useIlpStore'
import { buildExitReinvestmentBenchmark, buildExitReinvestmentPath } from './exitReinvestmentBenchmark'

describe('exitReinvestmentBenchmark', () => {
  it('builds horizon values for each exit year using net exit value plus remaining planned contributions', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const benchmark = buildExitReinvestmentBenchmark(policy, analysis)
    const exitYearThree = benchmark.options.find((option) => option.exitYear === 3)
    expect(exitYearThree).toBeTruthy()

    const projectionRows = analysis.projections.mid.rows
    const horizonExitYear = projectionRows.at(-1)?.year ?? 0
    const contributionRows = projectionRows.filter((row) => row.annualContribution > 0 && row.year > 3)

    const expectedAt4 = exitYearThree!.netExitValue * Math.pow(1.04, horizonExitYear - 3)
      + contributionRows.reduce((sum, row) => sum + row.annualContribution * Math.pow(1.04, horizonExitYear - row.year), 0)
    const expectedAt7 = exitYearThree!.netExitValue * Math.pow(1.07, horizonExitYear - 3)
      + contributionRows.reduce((sum, row) => sum + row.annualContribution * Math.pow(1.07, horizonExitYear - row.year), 0)

    expect(exitYearThree!.horizonValueAt4).toBeCloseTo(expectedAt4, 6)
    expect(exitYearThree!.horizonValueAt7).toBeCloseTo(expectedAt7, 6)
    expect(exitYearThree!.horizonValueAt7).toBeGreaterThan(exitYearThree!.horizonValueAt4)
  })

  it('builds a selected path that stays in the ILP until exit and then grows outside', () => {
    const { products, manifest } = getIlpCatalog()
    const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
    expect(product).toBeTruthy()

    const seed = templateVariantToPolicySeed(product!, product!.variants[0], manifest)
    const policy = mergePolicySeed(seed)
    const analysis = analyzeIlpPolicy(policy)
    expect(analysis.mode).toBe('projected')

    const benchmark = buildExitReinvestmentBenchmark(policy, analysis)
    const exitYearThree = benchmark.options.find((option) => option.exitYear === 3)
    expect(exitYearThree).toBeTruthy()

    const path = buildExitReinvestmentPath(analysis, 3, exitYearThree!.netExitValue, 0.04)

    expect(path.find((point) => point.year === 2)?.selectedPathValue).toBeCloseTo(
      analysis.projections.mid.rows[1]!.combinedValue,
      6,
    )
    expect(path.find((point) => point.year === 3)?.selectedPathValue).toBeCloseTo(exitYearThree!.netExitValue, 6)
    expect(path.at(-1)?.selectedPathValue).toBeCloseTo(exitYearThree!.horizonValueAt4, 6)
  })
})
