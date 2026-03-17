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
  let applicableTier = platform.tiers[0]
  for (const tier of platform.tiers) {
    if (tier.minAmount <= portfolioSize) {
      applicableTier = tier
    }
  }
  return applicableTier.rate + platform.estimatedTer
}
