import { describe, expect, it } from 'vitest'
import {
  classifyRow,
  collectRows,
} from './generateCurrentBenefitCoverageReport'

describe('generateCurrentBenefitCoverageReport', () => {
  it('recognizes hyphenated residual-after-TI calculator proofs for HSBC wealth-family products', () => {
    const rows = collectRows(
      [
        {
          id: 'hsbc-life-wealth-harvest',
          productName: 'Wealth Harvest',
          insurer: 'HSBC Life',
          supportStatus: 'supported',
          structureStatus: 'structured',
          economicsStatus: 'supported',
          modeledEconomics: ['kernel:current-residual-death-benefit-after-ti-estimate'],
        },
      ],
      `
        it('adds a HSBC Wealth Harvest residual death-benefit estimate after a TI claim today', () => {})
      `,
      `
        it('shows Wealth Harvest TI Benefit Today once the remaining aggregate TI cap is filled', () => {})
        expect(screen.getAllByText('Death Benefit After TI Claim Today').length).toBeGreaterThan(0)
      `,
      'hsbc-life-wealth-harvest kernel:current-residual-death-benefit-after-ti-estimate',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.calculatorCoverage).toBe(true)
    expect(rows[0]?.reviewCoverage).toBe(true)
    expect(rows[0]?.templateCoverage).toBe(true)
    expect(classifyRow(rows[0]!)).toBe('covered')
  })
})
