import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { ilpCatalogProductSchema } from '../../../src/lib/ilp-catalog/schema'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText'
import { extractPdfText } from '../pdf/extractPdfText'
import { parseTokioMarineGoEliteSecure } from './tokioMarineGoEliteSecure'

const PDF_DIR = process.env.ILP_SOURCE_PDF_DIR ?? '/Users/tj/Downloads/pdfs'
const SOURCE_PATH = `${PDF_DIR}/TML_ULI_TPDN_CIZ_Summary.pdf`

async function sha256(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

function makeSyntheticDocument(): ExtractedPdfDocument {
  return {
    filePath: '/synthetic/TML_ULI_TPDN_CIZ_Summary.pdf',
    pageCount: 11,
    totalCharacters: 2_600,
    pages: [
      {
        pageNumber: 1,
        characterCount: 420,
        text: '#goElite Secure overview',
        lines: [
          { y: 700, text: 'PRODUCT SUMMARY − #GOELITE SECURE' },
          { y: 680, text: '#goElite Secure is a whole life, single premium investment-linked insurance policy.' },
          { y: 660, text: 'You may pay the single premium, recurring single premium and/or top up premium using cash or monies from Supplementary Retirement Scheme account.' },
          { y: 640, text: 'The Locked-in Policy Value is the highest monthly Single Premium Units Account value and will be adjusted when there are changes in benefits.' },
        ],
      },
      {
        pageNumber: 3,
        characterCount: 420,
        text: 'Single premium and recurring single premium',
        lines: [
          { y: 700, text: 'Single Premium 100% of the single premium will be allocated to purchase units.' },
          { y: 680, text: 'Recurring Single Premium You may pay recurring single premium at any time after one year from the commencement date.' },
          { y: 660, text: '100% of each recurring single premium paid net of premium charge will be used to purchase units and allocated to the Top-up Units Account.' },
        ],
      },
      {
        pageNumber: 4,
        characterCount: 380,
        text: 'Top-up premium and partial withdrawal',
        lines: [
          { y: 700, text: 'Top-up Premiums 100% of top-up premium paid net of premium charge will be used to purchase units and allocated to the Top-up Units Account.' },
          { y: 680, text: 'Partial Withdrawal You may request for a partial withdrawal from the Single Premium Units Account and/or Top-up Units Account value at any time.' },
          { y: 660, text: 'The minimum amount to be withdrawn is at least $500 per transaction.' },
        ],
      },
      {
        pageNumber: 6,
        characterCount: 380,
        text: 'Dividend distribution',
        lines: [
          { y: 700, text: 'Dividend Distribution' },
          { y: 680, text: 'Cash Policies have the option to either reinvest these dividends or receive payments of these dividends in the form of cash.' },
          { y: 660, text: 'If you choose to reinvest dividends we will reinvest these dividends on your behalf on the next pricing day after Payment Date.' },
        ],
      },
      {
        pageNumber: 7,
        characterCount: 420,
        text: 'Fees and charges',
        lines: [
          { y: 700, text: 'Establishment Charge An establishment charge of 1.4% p.a. of the initial single premium paid on the commencement date will be deducted monthly in advance during the first five policy years.' },
          { y: 680, text: 'Administrative Charge As long as the policy is in-force, an administrative charge of 1.00% p.a. of the Single Premium Units Account value will be deducted monthly in advance.' },
          { y: 660, text: 'Monthly Protection Charge A MPC will be deducted monthly in advance from the Single Premium Units Account value.' },
        ],
      },
      {
        pageNumber: 2,
        characterCount: 420,
        text: 'Reduction in locked-in policy value and death benefit',
        lines: [
          { y: 700, text: 'Reduction in Locked-in Policy Value' },
          { y: 680, text: 'The minimum Locked-in Policy Value is 100% of the Adjusted Single Premium.' },
          { y: 660, text: 'Adjusted Single Premium refers to initial single premium or adjusted single premium following any partial withdrawal made from the Single Premium Units Account, whichever is lower.' },
          { y: 640, text: 'Death Benefit highest of Single premium adjusted for all partial withdrawal from the Single Premium Units Account, Locked-in Policy Value, or 100% of Single Premium Units Account value, less indebtedness.' },
        ],
      },
      {
        pageNumber: 5,
        characterCount: 360,
        text: 'Partial withdrawal effects',
        lines: [
          { y: 700, text: 'Upon each partial withdrawal from the Single Premium Units Account, the Locked-in Policy Value and Adjusted Single Premium will be adjusted.' },
          { y: 680, text: 'Adjusted Single Premium after partial withdrawal equals Adjusted Single Premium before partial withdrawal times the post-withdrawal Single Premium Units Account ratio.' },
        ],
      },
      {
        pageNumber: 8,
        characterCount: 360,
        text: 'Surrender and switching charges',
        lines: [
          { y: 700, text: 'Surrender Charge A surrender charge will be levied upon surrender of the policy at any time prior to the end of the five policy years.' },
          { y: 680, text: 'Partial Withdrawal Charge Nil' },
          { y: 660, text: 'Switching Charge There are no charges for fund switch.' },
        ],
      },
      {
        pageNumber: 11,
        characterCount: 240,
        text: 'Appendix A monthly protection charge rates',
        lines: [
          { y: 700, text: 'Monthly Rates for Monthly Protection Charges (For Death), Per $1,000 Sum at Risk' },
        ],
      },
    ],
  }
}

function expectSecureMpcVariantShape(variant: ReturnType<typeof parseTokioMarineGoEliteSecure>['variants'][number]) {
  expect(variant.exitChargeBasis).toBe('initial-single-premium-base')
  expect(variant.eecTable).toEqual([0.07, 0.056, 0.042, 0.028, 0.014, 0])
  expect(variant.feeRules.map((rule) => rule.id)).toEqual([
    'single-premium-charge',
    'establishment-charge',
    'administrative-charge',
    'monthly-protection-charge',
  ])
  expect(variant.feeRules).toHaveLength(4)
  expect(variant.feeRules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'single-premium-charge',
      rate: 0,
    }),
    expect.objectContaining({
      id: 'establishment-charge',
      basis: 'initial-single-premium-base',
      rateSchedule: [
        { startPolicyYear: 1, endPolicyYear: 1, rate: 0.014 },
        { startPolicyYear: 2, endPolicyYear: 2, rate: 0.014 },
        { startPolicyYear: 3, endPolicyYear: 3, rate: 0.014 },
        { startPolicyYear: 4, endPolicyYear: 4, rate: 0.014 },
        { startPolicyYear: 5, endPolicyYear: 5, rate: 0.014 },
      ],
    }),
    expect.objectContaining({
      id: 'administrative-charge',
      basis: 'account-value',
      rate: 0.01,
    }),
    expect.objectContaining({
      id: 'monthly-protection-charge',
      basis: 'assurance-sum-at-risk',
      rate: 0,
      amount: 0,
      activeWindow: 'policy-term',
      appliesTo: ['policy'],
      assuranceValueAppliesTo: ['policy'],
      requiresManualInput: true,
      assuranceConfig: {
        formula: 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
        rateTable: 'tokio-mpc-unzo-death',
        monthlyModalFactor: 1,
        maxAgeNextBirthday: 99,
        tokioProtectionState: {
          mode: 'locked-in-policy-value-with-adjusted-single-premium',
          trackedValueAccountIds: ['policy'],
          withdrawalReductionAccountIds: ['policy'],
        },
      },
    }),
  ]))
  const mpcRule = variant.feeRules.find((rule) => rule.id === 'monthly-protection-charge')
  expect(mpcRule).toBeDefined()
  expect(mpcRule?.notes).toEqual([
    'Models the published Monthly Protection Charge deducted monthly in advance from the Single Premium Units Account value while the policy remains in force.',
    'The sum at risk is the published death benefit less the Single Premium Units Account value, where the death-benefit floor is the higher of the Locked-in Policy Value and Adjusted Single Premium.',
    'The engine uses an annual approximation of the published monthiversary locked-in-value updates and proportional partial-withdrawal reductions to Locked-in Policy Value and Adjusted Single Premium.',
    'Change-of-life-assured administration and payout handling beyond the modeled Monthly Protection Charge remain metadata-only.',
  ])
  expect(mpcRule?.sourceRefs.map((sourceRef) => sourceRef.page)).toEqual([1, 2, 5, 7, 11])
  expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 1)?.excerpt).toContain('#goElite Secure')
  expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 7)?.excerpt).toContain('Administrative Charge')
  expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 11)?.excerpt).toContain('Monthly Rates for Monthly Protection Charges')
  expect(variant.eventChargeRules.map((rule) => rule.id)).toEqual([
    'recurring-single-premium-charge',
    'top-up-premium-charge',
    'partial-withdrawal-charge',
  ])
  expect(variant.warnings).toHaveLength(3)
  expect(variant.warnings[0]).toContain('adjusted-single-premium protection-state kernel')
  expect(variant.warnings[1]).toContain('Recurring single premium and top-up availability only after one policy year')
  expect(variant.warnings[2]).toContain('minimum residual Single Premium Units Account rules')
}

describe('parseTokioMarineGoEliteSecure', () => {
  it('builds a valid supported product from extracted summary text', async () => {
    const document = makeSyntheticDocument()
    const product = parseTokioMarineGoEliteSecure({
      document,
      sourceChecksumSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.id).toBe('tokio-marine-goelite-secure')
    expect(product.productName).toBe('#goElite Secure')
    expect(product.supportStatus).toBe('supported')
    expect(product.economicsStatus).toBe('supported')
    expect(product.modeledEconomics).toEqual([
      'branch:tokio-marine-goelite-secure-zero-single-premium-charge',
      'branch:tokio-marine-goelite-secure-establishment-charge',
      'branch:tokio-marine-goelite-secure-administrative-charge',
      'kernel:tokio-locked-in-protection-state',
      'branch:tokio-marine-goelite-secure-recurring-single-and-top-up-charge',
      'branch:tokio-marine-goelite-secure-zero-partial-withdrawal-charge',
      'branch:tokio-marine-goelite-secure-surrender-charge',
      'kernel:distribution-mode-assumption',
    ])
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-establishment-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-surrender-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-monthly-protection-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-locked-in-policy-value')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-adjusted-single-premium')
    expect(product.metadataOnlyBehaviors).toContain('tokio-marine-goelite-secure-death-benefit')
    expect(product.warnings).toEqual([
      expect.stringContaining('supported V1 product'),
      expect.stringContaining('death-benefit floor logic across Locked-in Policy Value and Adjusted Single Premium'),
    ])

    expect(product.variants).toHaveLength(2)
    expect(product.variants[0]).toMatchObject({
      id: 'sgd-open-ended-cash',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expect(product.variants[1]).toMatchObject({
      id: 'sgd-open-ended-srs',
      currency: 'SGD',
      mipBasis: 'open-ended',
      mipLength: null,
    })
    expectSecureMpcVariantShape(product.variants[0])
    expectSecureMpcVariantShape(product.variants[1])
    expect(product.variants[0].eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(product.variants[1].eventChargeRules).toEqual([
      expect.objectContaining({
        id: 'recurring-single-premium-charge',
        trigger: 'recurring-single-premium',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'top-up-premium-charge',
        trigger: 'top-up',
        rate: 0.05,
      }),
      expect.objectContaining({
        id: 'partial-withdrawal-charge',
        trigger: 'partial-withdrawal',
        rate: 0,
      }),
    ])
    expect(product.variants[0].distributionSupport).toMatchObject({
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
    })
    expect(product.variants[1].distributionSupport).toMatchObject({
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: false,
      cashPayoutAllowedAfterMip: false,
    })
  })

  it('falls back to section-based source excerpts when pages for secure MPC evidence are unavailable', async () => {
    const document = makeSyntheticDocument()
    const sparseDocument: ExtractedPdfDocument = {
      ...document,
      pageCount: document.pageCount,
      pages: document.pages.filter((page) => ![2, 5, 11].includes(page.pageNumber)),
    }

    const product = parseTokioMarineGoEliteSecure({
      document: sparseDocument,
      sourceChecksumSha256: '2222222222222222222222222222222222222222222222222222222222222222',
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-monthly-protection-charge')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-locked-in-policy-value')
    expect(product.metadataOnlyBehaviors).not.toContain('tokio-marine-goelite-secure-adjusted-single-premium')
    expect(product.warnings).toEqual([
      expect.stringContaining('supported V1 product'),
      expect.stringContaining('death-benefit floor logic across Locked-in Policy Value and Adjusted Single Premium'),
    ])
    const mpcRule = product.variants[0].feeRules.find((rule) => rule.id === 'monthly-protection-charge')
    expect(mpcRule).toBeDefined()
    expect(mpcRule?.assuranceConfig).toEqual({
      formula: 'tokio-mpc-locked-in-policy-value-with-adjusted-single-premium',
      rateTable: 'tokio-mpc-unzo-death',
      monthlyModalFactor: 1,
      maxAgeNextBirthday: 99,
      tokioProtectionState: {
        mode: 'locked-in-policy-value-with-adjusted-single-premium',
        trackedValueAccountIds: ['policy'],
        withdrawalReductionAccountIds: ['policy'],
      },
    })
    expect(mpcRule?.sourceRefs.map((sourceRef) => sourceRef.page)).toEqual([1, 2, 5, 7, 11])
    expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 1)?.excerpt).toContain('#goElite Secure')
    expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 7)?.excerpt).toContain('Administrative Charge')
    expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 2)?.excerpt).toContain('excerpt unavailable')
    expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 5)?.excerpt).toContain('excerpt unavailable')
    expect(mpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 11)?.excerpt).toContain('excerpt unavailable')
    const srsMpcRule = product.variants[1].feeRules.find((rule) => rule.id === 'monthly-protection-charge')
    expect(srsMpcRule).toBeDefined()
    expect(srsMpcRule?.assuranceConfig).toEqual(mpcRule?.assuranceConfig)
    expect(srsMpcRule?.sourceRefs.map((sourceRef) => sourceRef.page)).toEqual([1, 2, 5, 7, 11])
    expect(srsMpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 2)?.excerpt).toContain('excerpt unavailable')
    expect(srsMpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 5)?.excerpt).toContain('excerpt unavailable')
    expect(srsMpcRule?.sourceRefs.find((sourceRef) => sourceRef.page === 11)?.excerpt).toContain('excerpt unavailable')
  })

  it.skipIf(!existsSync(SOURCE_PATH))('matches the live source PDF when the local corpus is available', async () => {
    const document = await extractPdfText(SOURCE_PATH)
    const checksum = await sha256(SOURCE_PATH)
    const product = parseTokioMarineGoEliteSecure({
      document,
      sourceChecksumSha256: checksum,
    })

    expect(() => ilpCatalogProductSchema.parse(product)).not.toThrow()
    expect(product.sourceChecksumSha256).toBe(checksum)
  }, 30_000)
})
