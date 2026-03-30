import { describe, expect, it } from 'vitest'
import {
  collectRows,
  isManualByDesignCurrentStateItem,
  renderMarkdown,
} from './generateOutsideCurrentModelsReport'

describe('generateOutsideCurrentModelsReport', () => {
  it('classifies manual current-state inputs as manual-by-design notes instead of blockers', () => {
    expect(
      isManualByDesignCurrentStateItem(
        'The current death benefit keeps a manual current insured amount input because insurer-approved insured-amount changes and claim-side reductions are live policy facts this app cannot observe; that field is manual by design in V1.',
      ),
    ).toBe(true)
    expect(
      isManualByDesignCurrentStateItem(
        'The current terminal-illness snapshot and residual death-benefit estimate after a TI claim today keep the same manual current net protected premium base requirement once Regular Withdrawal assumptions are already active because past top-up-first payout routing changes today’s protected base in ways this app cannot infer; that field is manual by design in V1.',
      ),
    ).toBe(true)
    expect(
      isManualByDesignCurrentStateItem(
        'The current admitted-state TI payable amount and residual death-benefit estimate after a TI claim today are supported through the published partial-TI continuation corridor after manual claim-amount and residual-death input, but claim exclusions and insurer-side settlement mechanics remain informational only.',
      ),
    ).toBe(true)
    expect(
      isManualByDesignCurrentStateItem(
        'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
      ),
    ).toBe(false)
  })

  it('splits manual-by-design current-state notes out of the unsupported queue', () => {
    const rows = collectRows([
      {
        id: 'test-product',
        productName: 'Test Product',
        insurer: 'Test Insurer',
        supportStatus: 'supported',
        structureStatus: 'structured',
        economicsStatus: 'supported',
        metadataOnlyBehaviors: ['test-metadata-only'],
        variants: [
          {
            id: 'sgd',
            unsupportedItems: [
              'The current death benefit keeps a manual current insured amount input because insurer-approved insured-amount changes and claim-side reductions are live policy facts this app cannot observe; that field is manual by design in V1.',
              'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
            ],
          },
        ],
      },
    ])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.manualByDesignCurrentStateItems).toEqual([
      'The current death benefit keeps a manual current insured amount input because insurer-approved insured-amount changes and claim-side reductions are live policy facts this app cannot observe; that field is manual by design in V1.',
    ])
    expect(rows[0]?.unsupportedItems).toEqual([
      'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
    ])
  })

  it('renders a dedicated manual-by-design current-state column in markdown', () => {
    const markdown = renderMarkdown([
      {
        productId: 'test-product',
        productName: 'Test Product',
        insurer: 'Test Insurer',
        supportStatus: 'supported',
        structureStatus: 'structured',
        economicsStatus: 'supported',
        metadataOnlyBehaviorCount: 0,
        metadataOnlyBehaviors: [],
        manualByDesignCurrentStateCount: 1,
        manualByDesignCurrentStateItems: [
          'The current death benefit keeps a manual current insured amount input because insurer-approved insured-amount changes and claim-side reductions are live policy facts this app cannot observe; that field is manual by design in V1.',
        ],
        unsupportedItemCount: 1,
        unsupportedItems: [
          'Life Replacement Option request timing, replacement eligibility, and underwriting acceptance remain informational only.',
        ],
        variantManualByDesignMatrix: [],
        variantUnsupportedMatrix: [],
      },
    ])

    expect(markdown).toContain('Manual-by-Design Current-State Notes')
    expect(markdown).toContain('manual current insured amount input')
    expect(markdown).toContain('Life Replacement Option request timing')
  })
})
