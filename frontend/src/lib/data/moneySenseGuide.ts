/**
 * MoneySense Basic Financial Planning Guide — quoted text and source URLs.
 * Source: https://www.moneysense.gov.sg/planning-your-finances-well/
 * Published by MAS in collaboration with ABS, AFAS, and LIA Singapore.
 * Guide PDF (Sep 2023): https://www.moneysense.gov.sg/files/Streamlined_Basic_Financial_Planning_Guide__circulate_on_26_Sep_2023_.pdf
 */

export interface MoneySenseArea {
  id: string
  title: string
  /** Direct quote from MoneySense guide */
  quote: string
  /** Additional educational context (paraphrased, not a direct quote) */
  context: string
  /** Source attribution */
  source: string
  sourceUrl: string
  /** Ratio IDs from HEALTH_RATIOS that belong to this area */
  ratioIds: string[]
  /** Whether this area includes the InsuranceNeedsPanel instead of/alongside ratios */
  includesInsurance: boolean
  /** Cross-links to other pages in the app */
  actionLinks: { label: string; to: string; external?: boolean }[]
}

export const MONEYSENSE_AREAS: MoneySenseArea[] = [
  {
    id: 'emergency-funds',
    title: 'Emergency Funds',
    quote: 'Set aside at least 3 to 6 months\' worth of expenses.',
    context:
      'If your income is irregular, aim for 12 months. Consider savings accounts and Singapore Savings Bonds (SSBs).',
    source: 'MoneySense Basic Financial Planning Guide',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['emergency-fund', 'savings-ratio'],
    includesInsurance: false,
    actionLinks: [],
  },
  {
    id: 'protection',
    title: 'Protection',
    quote:
      'Obtain insurance protection for Death & Total Permanent Disability: 9x annual income. ' +
      'Critical Illness: 4x annual income. Spend at most 15% of income on insurance protection.',
    context:
      'Citizens and PRs are automatically covered by DPS ($70,000 until age 59), ' +
      'MediShield Life for large hospital bills, and CareShield Life for long-term care. ' +
      '"Consider Term Insurance Plans for affordable protection." — MoneySense',
    source: 'MoneySense Basic Financial Planning Guide; LIA Singapore',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: [],
    includesInsurance: true,
    // NOTE: ILP Review page exists but has no route in production (hidden in commit eb555b98).
    // Add the '/ilp-review' link here when the route is re-enabled.
    actionLinks: [
      { label: 'CompareFIRST portal', to: 'https://www.comparefirst.sg/wap/homeEvent.action', external: true },
    ],
  },
  {
    id: 'debt-health',
    title: 'Debt Health',
    quote: 'Prioritise paying off high interest debts (e.g. credit card bills), to avoid high interest charges.',
    context:
      'MAS caps total debt servicing at 55% of gross income for lending decisions (TDSR framework). ' +
      'The thresholds below are stricter personal finance targets, not regulatory limits.',
    source: 'MoneySense Basic Financial Planning Guide; MAS TDSR framework',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['tdsr', 'non-mortgage-dsr', 'debt-to-asset'],
    includesInsurance: false,
    actionLinks: [],
  },
  {
    id: 'investments',
    title: 'Investments',
    quote: 'Invest at least 10% of income for retirement and other financial goals.',
    context:
      'Short-term: SSBs, T-bills, fixed deposits. Long-term: CPF top-ups (up to $8,000/yr tax relief), ETFs, or unit trusts.',
    source: 'MoneySense Basic Financial Planning Guide',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
    ratioIds: ['liquid-to-nw', 'investment-to-nw', 'solvency', 'fee-drag'],
    includesInsurance: false,
    actionLinks: [
      { label: 'Run Monte Carlo simulation', to: '/stress-test' },
      { label: 'View year-by-year projection', to: '/projection' },
    ],
  },
]

/** Life-stage guide PDF links from MoneySense (Jan 2024 update, 4 of 6 variants included). */
export const LIFE_STAGE_GUIDES: { minAge: number; maxAge: number; label: string; url: string }[] = [
  {
    minAge: 19,
    maxAge: 29,
    label: 'Working Adult (Starting Out)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__working_adult__starting_out_.pdf',
  },
  {
    minAge: 25,
    maxAge: 39,
    label: 'Working Adult (Starting a Family)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__working_adult__starting_a_family_.pdf',
  },
  {
    minAge: 35,
    maxAge: 59,
    label: 'Working Adult (Supporting Children & Parents)',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english____working_adult__children__parents_.pdf',
  },
  {
    minAge: 55,
    maxAge: 120,
    label: 'Pre-Retiree / Retiree',
    url: 'https://www.moneysense.gov.sg/files/Basic%20Financial%20Planning%20Guide/english__retiree_.pdf',
  },
]

/** Returns the best-matching life-stage guide for a given age. */
export function getLifeStageGuide(age: number): typeof LIFE_STAGE_GUIDES[number] | null {
  // Prefer narrower ranges by iterating in order (starting-out < starting-family < supporting < retiree)
  for (const guide of LIFE_STAGE_GUIDES) {
    if (age >= guide.minAge && age <= guide.maxAge) return guide
  }
  return null
}

export const MONEYSENSE_DISCLAIMER =
  'This assessment uses rules of thumb from the Basic Financial Planning Guide, ' +
  'published by the Monetary Authority of Singapore in collaboration with ABS, AFAS, ' +
  'and LIA Singapore. It is for educational purposes only and does not constitute financial advice.'
