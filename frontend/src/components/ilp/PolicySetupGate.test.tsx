import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PolicySetupGate } from '@/components/ilp/PolicySetupGate'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { templateVariantToPolicySeed } from '@/lib/ilp-catalog/templateToPolicy'

function getAiaEliteSecureIncomeSeed() {
  const { manifest, products } = getIlpCatalog()
  const product = products.find((entry) => entry.id === 'aia-elite-secure-income-5-pay')
  expect(product).toBeDefined()

  const variant = product?.variants.find((entry) => entry.id === 'sgd-mip-5')
  expect(variant).toBeDefined()

  return templateVariantToPolicySeed(product!, variant!, manifest)
}

describe('PolicySetupGate', () => {
  it('locks seeded fund management fee while keeping user-owned policy details editable', () => {
    const seed = getAiaEliteSecureIncomeSeed()

    render(
      <PolicySetupGate
        seed={seed}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('1.5')).toBeDisabled()
    expect(screen.getByText(/fund management fee is seeded from the catalog template here/i)).toBeInTheDocument()

    expect(screen.getByLabelText(/monthly premium/i)).toBeEnabled()
    expect(screen.getByLabelText(/current policy year/i)).toBeEnabled()
    expect(screen.getByLabelText(/months already paid/i)).toBeEnabled()
  })
})
