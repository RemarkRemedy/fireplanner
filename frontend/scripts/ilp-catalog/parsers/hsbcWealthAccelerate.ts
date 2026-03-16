import path from 'node:path'
import type {
  IlpCatalogProduct,
  IlpCatalogSourceRef,
  IlpTemplateBonus,
  IlpTemplateEventChargeRule,
  IlpTemplateFeeRule,
  IlpTemplateVariant,
} from '../../../src/lib/ilp-catalog/types.js'
import type { ExtractedPdfDocument } from '../pdf/extractPdfText.js'

interface ParseContext {
  document: ExtractedPdfDocument
  sourceChecksumSha256: string
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sourceRef(page: number, section: string, excerpt: string): IlpCatalogSourceRef {
  return {
    page,
    section,
    excerpt: normalizeWhitespace(excerpt).slice(0, 220),
  }
}

function roundRate(value: number): number {
  return Number(value.toFixed(6))
}

function snippetNear(document: ExtractedPdfDocument, pageNumber: number, keyword: string, lineWindow = 6): string {
  const page = document.pages.find((candidate) => candidate.pageNumber === pageNumber)
  if (!page) return ''

  const lineIndex = page.lines.findIndex((line) => line.text.toLowerCase().includes(keyword.toLowerCase()))
  if (lineIndex === -1) {
    return page.lines.slice(0, lineWindow).map((line) => line.text).join(' ')
  }

  return page.lines.slice(lineIndex, lineIndex + lineWindow).map((line) => line.text).join(' ')
}

function parseStartUpBonuses(section: string): Array<{ year: number, mip25: number | null, mip30: number | null }> {
  const rows = Array.from(section.matchAll(/^\s*(\d+)\s+(\d+)%\s+(\d+)?%?\s*$/gm))
  return rows.map((match) => ({
    year: Number(match[1]),
    mip25: Number(match[2]) / 100,
    mip30: match[3] ? Number(match[3]) / 100 : null,
  }))
}

function parsePowerUpRates(section: string): {
  mip25Lower: number
  mip25Upper: number
  mip30Lower: number
  mip30Upper: number
} {
  const lowerMatch = section.match(/Less than S\$9,600\s*\/[\s\S]*?(\d+\.\d+)%\s+(\d+\.\d+)%/)
  const upperMatch = section.match(/S\$9,600\s*\/\s*US\$6,720[\s\S]*?(\d+\.\d+)%\s+(\d+\.\d+)%/)

  if (!lowerMatch || !upperMatch) {
    throw new Error('Unable to parse HSBC Wealth Accelerate power-up bonus tiers.')
  }

  return {
    mip25Lower: Number(lowerMatch[1]) / 100,
    mip30Lower: Number(lowerMatch[2]) / 100,
    mip25Upper: Number(upperMatch[1]) / 100,
    mip30Upper: Number(upperMatch[2]) / 100,
  }
}

function parseLoyaltyRates(section: string): { mip25: number, mip30: number } {
  const match = section.match(/25 Years\s+30 Years\s+(\d+\.\d+)%\s+(\d+\.\d+)%/)
  if (!match) {
    throw new Error('Unable to parse HSBC Wealth Accelerate loyalty bonus rates.')
  }

  return {
    mip25: Number(match[1]) / 100,
    mip30: Number(match[2]) / 100,
  }
}

function parseFeeRates(section: string): { amf: number, imf: number } {
  const amfMatch = section.match(/AMF Rate per annum:\s*(\d+(?:\.\d+)?)%/)
  const imfMatch = section.match(/IMF Rate per annum:\s*(\d+(?:\.\d+)?)%/)

  if (!amfMatch || !imfMatch) {
    throw new Error('Unable to parse HSBC Wealth Accelerate AMF/IMF rates.')
  }

  return {
    amf: Number(amfMatch[1]) / 100,
    imf: Number(imfMatch[1]) / 100,
  }
}

function parseEecTable(section: string, mipLength: 25 | 30): number[] {
  const rows = Array.from(section.matchAll(/^\s*(\d+)\s+(\d+)%\s+(\d+)%\s*$/gm))
  if (rows.length === 0) {
    throw new Error('Unable to parse HSBC Wealth Accelerate EEC table.')
  }

  return rows.slice(0, mipLength).map((match) => {
    const value = mipLength === 25 ? match[2] : match[3]
    return Number(value) / 100
  })
}

function buildVariant(
  document: ExtractedPdfDocument,
  currency: 'SGD' | 'USD',
  mipLength: 25 | 30,
  rates: { amf: number, imf: number },
  startUpRows: Array<{ year: number, mip25: number | null, mip30: number | null }>,
  powerUpRates: { mip25Lower: number, mip25Upper: number, mip30Lower: number, mip30Upper: number },
  loyaltyRates: { mip25: number, mip30: number },
  eecTable: number[],
): IlpTemplateVariant {
  const page3 = sourceRef(3, 'The policy', snippetNear(document, 3, 'HSBC Life Wealth Accelerate is a whole life'))
  const page4 = sourceRef(4, 'Power-up bonus', snippetNear(document, 4, '3.2. POWER-UP BONUS'))
  const page5 = sourceRef(5, 'Loyalty bonus', snippetNear(document, 5, '3.3. LOYALTY BONUS'))
  const page8 = sourceRef(8, 'Distribution of dividend', snippetNear(document, 8, '4.5.1. Dividend Handling', 18))
  const page9 = sourceRef(9, 'Policy premium', snippetNear(document, 9, 'Initial Contribution Period'))
  const page14 = sourceRef(14, 'Policy fees and charges', snippetNear(document, 14, 'AMF Rate per annum'))
  const page15 = sourceRef(15, 'Policy fees and charges', snippetNear(document, 15, 'PARTIAL'))
  const page31 = sourceRef(31, 'Appendix A: EEC rates table', snippetNear(document, 31, 'APPENDIX A'))

  const startUpBonuses: IlpTemplateBonus[] = startUpRows
    .filter((row) => (mipLength === 25 ? row.mip25 : row.mip30) != null)
    .map((row) => ({
      id: `startup-bonus-py${row.year}`,
      type: 'allocation',
      label: `Start-up Bonus (Policy Year ${row.year})`,
      mode: 'premium-allocation',
      appliesTo: ['iua'],
      startPolicyYear: row.year,
      endPolicyYear: row.year,
      rate: roundRate(mipLength === 25 ? row.mip25 ?? 0 : row.mip30 ?? 0),
      amount: null,
      tieredRates: [],
      notes: ['Allocated to the Initial Units Account during the applicable bonus year.'],
      sourceRefs: [sourceRef(3, 'Start-up bonus', snippetNear(document, 3, '3.1. START-UP BONUS'))],
    }))
  const startUpBonusMultiple = roundRate(startUpBonuses.reduce((sum, bonus) => sum + (bonus.rate ?? 0), 0))

  const powerUpBonus: IlpTemplateBonus = {
    id: 'power-up-bonus',
    type: 'power-up',
    label: 'Power-up Bonus',
    mode: 'annual-rate',
    appliesTo: ['aua'],
    startPolicyYear: 15,
    endPolicyYear: mipLength,
    rate: null,
    amount: null,
    tieredRates: currency === 'SGD'
      ? [
          {
            currency: 'SGD',
            minAnnualPremium: null,
            maxAnnualPremium: 9_599.99,
            rate: roundRate(mipLength === 25 ? powerUpRates.mip25Lower : powerUpRates.mip30Lower),
          },
          {
            currency: 'SGD',
            minAnnualPremium: 9_600,
            maxAnnualPremium: null,
            rate: roundRate(mipLength === 25 ? powerUpRates.mip25Upper : powerUpRates.mip30Upper),
          },
        ]
      : [
          {
            currency: 'USD',
            minAnnualPremium: null,
            maxAnnualPremium: 6_719.99,
            rate: roundRate(mipLength === 25 ? powerUpRates.mip25Lower : powerUpRates.mip30Lower),
          },
          {
            currency: 'USD',
            minAnnualPremium: 6_720,
            maxAnnualPremium: null,
            rate: roundRate(mipLength === 25 ? powerUpRates.mip25Upper : powerUpRates.mip30Upper),
          },
        ],
    restorationRules: [
      {
        trigger: 'premium-holiday-repayment',
        basis: 'account-value-plus-repaid-premium-with-missed-months',
      },
    ],
    notes: [
      'Allocated monthly to the AUA from Policy Year 15 until the end of the selected MIP.',
      'Forfeited for 12 policy months after partial withdrawal, premium holiday, or regular premium reduction.',
    ],
    sourceRefs: [page4],
  }

  const loyaltyBonus: IlpTemplateBonus = {
    id: 'loyalty-bonus',
    type: 'loyalty',
    label: 'Loyalty Bonus',
    mode: 'annual-rate',
    appliesTo: ['aua'],
    startPolicyYear: mipLength + 1,
    endPolicyYear: null,
    rate: roundRate(mipLength === 25 ? loyaltyRates.mip25 : loyaltyRates.mip30),
    amount: null,
    tieredRates: [],
    restorationRules: [
      {
        trigger: 'premium-holiday-repayment',
        basis: 'repaid-premium-with-missed-months',
      },
    ],
    notes: [
      'Allocated monthly to the AUA from the first policy month after the end of the selected MIP.',
      'Forfeited for 12 policy months after partial withdrawal.',
    ],
    sourceRefs: [page5],
  }

  const feeRules: IlpTemplateFeeRule[] = [
    {
      id: 'amf',
      label: 'Account Maintenance Fee',
      basis: 'account-value',
      rate: roundRate(rates.amf),
      appliesTo: ['iua'],
      activeWindow: 'during-mip',
      notes: ['Guaranteed throughout the MIP. No AMF applies after the end of the MIP.'],
      sourceRefs: [page14],
    },
    {
      id: 'imf',
      label: 'Investment Management Fee',
      basis: 'account-value',
      rate: roundRate(rates.imf),
      appliesTo: ['aua'],
      activeWindow: 'policy-term',
      notes: ['Guaranteed throughout the policy term.'],
      sourceRefs: [page14],
    },
  ]

  const eventChargeRules: IlpTemplateEventChargeRule[] = [
    {
      id: 'pwc-aua-during-mip',
      label: 'Partial Withdrawal Charge',
      trigger: 'partial-withdrawal',
      basis: 'event-amount',
      appliesTo: ['aua'],
      rate: 0.07,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'PWC applies to AUA partial withdrawals during the MIP.',
        'No PWC applies after the end of the MIP.',
        'Partial withdrawal from IUA is not allowed during the MIP.',
      ],
      sourceRefs: [page15],
    },
    {
      id: 'missed-imf-on-premium-holiday-repayment',
      label: 'Missed IMF on Repaid Premiums',
      trigger: 'premium-holiday-repayment',
      basis: 'repaid-premium-with-missed-months',
      appliesTo: ['aua'],
      rate: roundRate(rates.imf),
      amount: 0,
      activeWindow: 'policy-term',
      allocation: 'equal-split',
      notes: [
        'When missed premiums are repaid after a premium holiday, the missed IMF is deducted from the repaid regular premium amount.',
      ],
      sourceRefs: [page14, page15],
    },
    {
      id: 'brc-regular-premium-reduction',
      label: 'Bonus Recovery Charge',
      trigger: 'regular-premium-reduction',
      basis: 'premium-reduction-with-startup-recovery',
      appliesTo: ['iua'],
      rate: startUpBonusMultiple,
      amount: 0,
      activeWindow: 'during-mip',
      allocation: 'equal-split',
      notes: [
        'BRC applies to each regular premium reduction during the MIP.',
        'This parser models BRC using the extracted multiplier form: annual reduction amount x total start-up bonus multiple x remaining MIP fraction.',
        'BRC is deducted from the IUA when the reduced regular premium takes effect.',
      ],
      sourceRefs: [page15],
    },
  ]

  return {
    id: `${currency.toLowerCase()}-mip-${mipLength}`,
    currency,
    mipLength,
    icpMonths: mipLength === 25 ? 48 : 60,
    accounts: [
      {
        id: 'iua',
        label: 'Initial Units Account (IUA)',
        feeRate: roundRate(rates.amf),
        postMipFeeRate: null,
        subjectToEec: true,
        contributionRules: [
          { phase: 'during-icp', targetAccountId: 'iua', contributionShare: 1 },
        ],
        sourceRefs: [page9],
      },
      {
        id: 'aua',
        label: 'Accumulation Units Account (AUA)',
        feeRate: roundRate(rates.imf),
        postMipFeeRate: roundRate(rates.imf),
        subjectToEec: false,
        contributionRules: [
          { phase: 'after-icp', targetAccountId: 'aua', contributionShare: 1 },
          { phase: 'top-up', targetAccountId: 'aua', contributionShare: 1 },
        ],
        sourceRefs: [page9],
      },
    ],
    bonuses: [...startUpBonuses, powerUpBonus, loyaltyBonus],
    feeRules,
    eventChargeRules,
    distributionSupport: {
      mode: 'manual-assumption',
      accountIds: ['iua', 'aua'],
      defaultMode: 'reinvest',
      cashPayoutAllowedDuringMip: true,
      cashPayoutAllowedAfterMip: true,
      source: 'distribution-paying-funds',
      notes: [
        'Dividend-paying ILP sub-funds may either reinvest distributions or pay them out in cash, with reinvestment as the default if no option is elected.',
        'Cash payout applies to both the Initial Units Account and the Accumulation Units Account.',
        'V1 seeds reinvestment by default; cash payout requires a manual annual distribution-yield assumption while the published S$30 minimum payout threshold and designated-bank-account routing remain informational only.',
      ],
      sourceRefs: [page8],
    },
    eecTable,
    warnings: [
      'This template captures generic product mechanics plus reinvest-default distribution support. Personal policy fields still need user input.',
    ],
    unsupportedItems: [],
    sourceRefs: [page3, page4, page5, page8, page9, page14, page15, page31],
  }
}

export function parseHsbcWealthAccelerate(context: ParseContext): IlpCatalogProduct {
  const combinedText = context.document.pages.map((page) => page.text).join('\n')
  const startUpSection = combinedText.match(/3\.1\. START-UP BONUS([\s\S]*?)3\.2\. POWER-UP BONUS/)?.[1]
  const powerUpSection = combinedText.match(/3\.2\. POWER-UP BONUS([\s\S]*?)3\.3\. LOYALTY BONUS/)?.[1]
  const loyaltySection = combinedText.match(/3\.3\. LOYALTY BONUS([\s\S]*?)4\. BENEFITS/)?.[1]
  const feesSection = combinedText.match(/6\.1\.\s*FEES AND CHARGES([\s\S]*?)7\.\s*WITHDRAWAL/)?.[1]
  const eecSection = combinedText.match(/APPENDIX A: EEC RATES TABLE([\s\S]*)$/)?.[1]

  if (!startUpSection || !powerUpSection || !loyaltySection || !feesSection || !eecSection) {
    throw new Error('Unable to isolate one or more required sections from HSBC Wealth Accelerate.')
  }

  const startUpRows = parseStartUpBonuses(startUpSection)
  const powerUpRates = parsePowerUpRates(powerUpSection)
  const loyaltyRates = parseLoyaltyRates(loyaltySection)
  const feeRates = parseFeeRates(feesSection)

  const variants: IlpTemplateVariant[] = [
    buildVariant(context.document, 'SGD', 25, feeRates, startUpRows, powerUpRates, loyaltyRates, parseEecTable(eecSection, 25)),
    buildVariant(context.document, 'SGD', 30, feeRates, startUpRows, powerUpRates, loyaltyRates, parseEecTable(eecSection, 30)),
    buildVariant(context.document, 'USD', 25, feeRates, startUpRows, powerUpRates, loyaltyRates, parseEecTable(eecSection, 25)),
    buildVariant(context.document, 'USD', 30, feeRates, startUpRows, powerUpRates, loyaltyRates, parseEecTable(eecSection, 30)),
  ]

  return {
    id: 'hsbc-life-wealth-accelerate',
    insurer: 'HSBC Life',
    productName: 'Wealth Accelerate',
    sourceFileName: path.basename(context.document.filePath),
    sourceChecksumSha256: context.sourceChecksumSha256,
    sourceDocumentType: 'summary',
    sourceClass: 'summary',
    supportStatus: 'supported',
    structureStatus: 'structured',
    economicsStatus: 'supported',
    modeledEconomics: [
      'branch:hsbc-holiday-repayment',
      'branch:hsbc-holiday-no-repayment',
      'branch:hsbc-bonus-suspension',
      'branch:hsbc-premium-reduction-brc',
      'branch:hsbc-top-up-routing',
      'kernel:distribution-mode-assumption',
    ],
    metadataOnlyBehaviors: [
      'premium-holiday-delayed-or-partial-repayment',
      'hsbc-accelerate-dividend-payout-threshold',
      'hsbc-accelerate-dividend-bank-routing',
    ],
    warnings: [
      'Structured extraction validated against the product summary text layer. Premium-holiday repayment is modeled for full back-pay immediately after the latest holiday period; other holiday edge cases still require manual review.',
      'Wealth Accelerate keeps reinvestment as the default for dividend-paying funds, while cash payout can be explored through the manual distribution-mode assumption surface.',
    ],
    archived: false,
    variants,
  }
}
