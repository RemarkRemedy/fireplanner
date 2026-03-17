/**
 * Robo-advisor fee data for Singapore platforms.
 * Used by the /compare SEO landing page fee comparison calculator.
 *
 * Last verified: 2026-03-17
 */

export interface FeeTier {
  minAmount: number
  rate: number
}

export interface PlatformFees {
  id: string
  name: string
  tiers: FeeTier[] // sorted ascending by minAmount
  estimatedTer: number // average fund-level TER (0 for DIY ETFs)
  supportsSrs: boolean
  supportsCpfIs: boolean
  sourceUrl: string
  notes?: string
}

/** Display-only comparison data for the /compare platform table */
export interface PlatformComparison {
  id: string
  name: string
  feeDisplay: string          // e.g. "0.20% - 0.80%"
  terDisplay: string          // e.g. "~0.15 - 0.25%"
  minInvestment: string       // e.g. "$1" or "$1,000"
  investmentApproach: string  // e.g. "Passive ETFs"
  portfolioThemes: string     // e.g. "Core, ESG, Income, REIT+"
  autoRebalancing: boolean
  withdrawalFees: string      // e.g. "Free" or "$1 USD per action"
  bestFor: string             // one-liner summary
}

export const PLATFORM_COMPARISONS: PlatformComparison[] = [
  {
    id: 'endowus',
    name: 'Endowus',
    feeDisplay: '0.25% - 0.60%',
    terDisplay: '~0.20 - 0.40%',
    minInvestment: '$1,000',
    investmentApproach: 'Unit trusts and funds (100% trailer fee cashback)',
    portfolioThemes: 'Core, Income, Cash Smart, Fund Smart, ESG',
    autoRebalancing: true,
    withdrawalFees: 'Free',
    bestFor: 'CPF-IS and SRS investors who want fund-level diversification',
  },
  {
    id: 'stashaway',
    name: 'StashAway',
    feeDisplay: '0.20% - 0.80%',
    terDisplay: '~0.15 - 0.25%',
    minInvestment: '$1',
    investmentApproach: 'Passive ETFs with proprietary ERAA strategy',
    portfolioThemes: 'General, Income, Thematic (Tech, ESG, Healthcare), Flexible',
    autoRebalancing: true,
    withdrawalFees: '$1 USD per invest/withdraw action',
    bestFor: 'Beginners who want a low barrier to entry and guided portfolios',
  },
  {
    id: 'syfe',
    name: 'Syfe',
    feeDisplay: '0.25% - 0.65%',
    terDisplay: '~0.10 - 0.20%',
    minInvestment: '$1',
    investmentApproach: 'UCITS ETFs (also offers Syfe Brokerage for DIY)',
    portfolioThemes: 'Core, REIT+, Income+, Equity100, Thematic, Custom',
    autoRebalancing: true,
    withdrawalFees: 'Free',
    bestFor: 'Investors who want thematic options (REITs, income) alongside core portfolios',
  },
  {
    id: 'dbs-digiportfolio',
    name: 'DBS digiPortfolio',
    feeDisplay: '0.25% - 0.75%',
    terDisplay: '~0.20%',
    minInvestment: 'No minimum',
    investmentApproach: 'Managed ETF portfolios by DBS CIO',
    portfolioThemes: 'Saveup (0.25%), Asia, Global, Sustainability',
    autoRebalancing: true,
    withdrawalFees: 'Free',
    bestFor: 'DBS customers who want a bank-integrated, no-minimum option',
  },
  {
    id: 'diy-ibkr',
    name: 'DIY (IBKR)',
    feeDisplay: '$0 platform fee',
    terDisplay: '~0.03 - 0.22%',
    minInvestment: 'No minimum',
    investmentApproach: 'Self-directed ETF/stock investing',
    portfolioThemes: 'Unlimited (you pick your own ETFs)',
    autoRebalancing: false,
    withdrawalFees: 'Free',
    bestFor: 'Experienced investors who want lowest costs and full control',
  },
]

export const ROBO_FEES_LAST_VERIFIED = '2026-03-17'

export const ROBO_FEES: PlatformFees[] = [
  {
    id: 'endowus',
    name: 'Endowus',
    tiers: [{ minAmount: 0, rate: 0.004 }],
    estimatedTer: 0.003,
    supportsSrs: true,
    supportsCpfIs: true,
    sourceUrl: 'https://endowus.com/pricing',
    notes: '100% trailer fee cashback. Fund Smart single fund: 0.30%.',
  },
  {
    id: 'stashaway',
    name: 'StashAway',
    tiers: [
      { minAmount: 0, rate: 0.008 },
      { minAmount: 25_000, rate: 0.006 },
      { minAmount: 50_000, rate: 0.004 },
      { minAmount: 100_000, rate: 0.003 },
      { minAmount: 200_000, rate: 0.0025 },
      { minAmount: 500_000, rate: 0.002 },
    ],
    estimatedTer: 0.002,
    supportsSrs: true,
    supportsCpfIs: false,
    sourceUrl: 'https://www.stashaway.sg/pricing',
  },
  {
    id: 'syfe',
    name: 'Syfe',
    tiers: [
      { minAmount: 0, rate: 0.0065 },
      { minAmount: 50_000, rate: 0.0055 },
      { minAmount: 250_000, rate: 0.0045 },
      { minAmount: 1_000_000, rate: 0.0035 },
      { minAmount: 5_000_000, rate: 0.0025 },
    ],
    estimatedTer: 0.0015,
    supportsSrs: true,
    supportsCpfIs: false,
    sourceUrl: 'https://www.syfe.com/pricing',
    notes: 'UCITS ETFs: $0 per trade.',
  },
  {
    id: 'dbs-digiportfolio',
    name: 'DBS digiPortfolio',
    tiers: [{ minAmount: 0, rate: 0.0075 }],
    estimatedTer: 0.002,
    supportsSrs: false,
    supportsCpfIs: false,
    sourceUrl:
      'https://www.dbs.com.sg/personal/investments/other-investments/dbs-digiportfolio',
    notes:
      'Saveup Portfolio is 0.25%. All other portfolios 0.75%. No SRS or CPF-IS support.',
  },
  {
    id: 'diy-ibkr',
    name: 'DIY (IBKR)',
    tiers: [{ minAmount: 0, rate: 0 }],
    estimatedTer: 0.0012,
    supportsSrs: false,
    supportsCpfIs: false,
    sourceUrl: '',
    notes: 'No platform fee. ETF TER only. Cannot use for SRS or CPF-IS.',
  },
  {
    id: 'sgfireplanner',
    name: 'SGFirePlanner',
    tiers: [{ minAmount: 0, rate: 0 }],
    estimatedTer: 0,
    supportsSrs: false,
    supportsCpfIs: false,
    sourceUrl: 'https://sgfireplanner.com',
    notes: 'Free retirement planning tool. Not an investment platform.',
  },
]

/**
 * Returns the total fee rate (platform fee + estimated TER) for a given
 * portfolio size on a specific platform.
 *
 * Finds the highest tier where minAmount <= portfolioSize.
 */
export function getFeeRate(platform: PlatformFees, portfolioSize: number): number {
  if (platform.tiers.length === 0) return platform.estimatedTer
  let applicableTier = platform.tiers[0]
  for (const tier of platform.tiers) {
    if (tier.minAmount <= portfolioSize) {
      applicableTier = tier
    }
  }
  return applicableTier.rate + platform.estimatedTer
}
