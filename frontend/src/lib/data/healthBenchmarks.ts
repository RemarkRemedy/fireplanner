/**
 * Financial Health Check benchmarks and thresholds.
 * Sources: MoneySense, DBS, MAS, LIA.
 * Downloaded: 2026-03-10
 */

export type TrafficLight = 'green' | 'amber' | 'red'

export type RatioDirection = 'higher-is-better' | 'lower-is-better'

export interface HealthRatioMeta {
  id: string
  label: string
  shortLabel: string
  description: string
  formula: string
  unit: '%' | 'months' | 'ratio'
  direction: RatioDirection
  thresholds: {
    greenBound: number
    amberBound: number
  }
  tip: Record<TrafficLight, string>
  source: string
  sourceUrl?: string
}

export const HEALTH_RATIOS: HealthRatioMeta[] = [
  {
    id: 'emergency-fund',
    label: 'Emergency Fund',
    shortLabel: 'Emergency',
    description: 'Months of expenses covered by cash savings',
    formula: 'cashSavings / monthlyExpenses',
    unit: 'months',
    direction: 'higher-is-better',
    thresholds: { greenBound: 6, amberBound: 3 },
    tip: {
      green: 'Your emergency fund covers 6+ months. Well done.',
      amber: 'Aim to build up to 6 months of expenses in accessible cash.',
      red: 'Less than 3 months of expenses in cash. Prioritize building an emergency fund.',
    },
    source: 'MoneySense Basic Financial Planning Guide',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
  },
  {
    id: 'savings-ratio',
    label: 'Savings Ratio',
    shortLabel: 'Savings',
    description: 'Percentage of net (take-home) income saved each month',
    formula: '(netMonthlyIncome - monthlyExpenses) / netMonthlyIncome',
    unit: '%',
    direction: 'higher-is-better',
    // NOTE: Thresholds calibrated for net (take-home) income, which is stricter than
    // typical gross-basis benchmarks. This is intentional for a FIRE planner — CPF isn't
    // spendable cash, so net-basis gives a more honest picture. MoneySense quotes 10-20%
    // on gross; our 15%/10% on net is roughly equivalent to ~12%/8% on gross.
    // Design decision: may revert to gross-basis if user feedback shows confusion.
    thresholds: { greenBound: 0.15, amberBound: 0.10 },
    tip: {
      green: 'Saving 15%+ of take-home income. Strong foundation for FIRE.',
      amber: 'Saving 10-15% of take-home. Look for ways to increase savings rate.',
      red: 'Saving less than 10% of take-home income. Review expenses for reduction opportunities.',
    },
    source: 'MoneySense Basic Financial Planning Guide (thresholds adjusted for net income basis)',
    sourceUrl: 'https://www.moneysense.gov.sg/planning-your-finances-well/',
  },
  {
    id: 'tdsr',
    label: 'Total Debt Servicing Ratio',
    shortLabel: 'TDSR',
    description: 'Total monthly debt payments as percentage of gross income',
    formula: 'totalMonthlyDebtPayments / grossMonthlyIncome',
    unit: '%',
    direction: 'lower-is-better',
    // NOTE: MAS regulatory TDSR limit is 55% for lending decisions. We use stricter
    // personal finance thresholds (35%/50%) for health scoring — these are aspirational
    // targets, not regulatory compliance checks.
    thresholds: { greenBound: 0.35, amberBound: 0.50 },
    tip: {
      green: 'TDSR under 35%. Healthy debt servicing level.',
      amber: 'TDSR 35-50%. Manageable but elevated. Consider reducing debt or increasing income.',
      red: 'TDSR over 50%. Debt payments consume more than half of income. Urgent action needed.',
    },
    source: 'DBS Financial Health Ratios (personal finance thresholds; MAS regulatory limit is 55%)',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
  {
    id: 'non-mortgage-dsr',
    label: 'Non-Mortgage Debt Servicing',
    shortLabel: 'Non-Mtg DSR',
    description: 'Non-mortgage debt payments as percentage of gross income',
    formula: 'nonMortgageDebtMonthlyPayment / grossMonthlyIncome',
    unit: '%',
    direction: 'lower-is-better',
    thresholds: { greenBound: 0.15, amberBound: 0.25 },
    tip: {
      green: 'Non-mortgage debt servicing under 15%. Manageable.',
      amber: 'Non-mortgage debt at 15-25% of gross income. Consider accelerated repayment.',
      red: 'Non-mortgage debt over 25% of gross income. High risk of debt spiral.',
    },
    source: 'DBS Financial Health Ratios',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
  {
    id: 'debt-to-asset',
    label: 'Debt-to-Asset Ratio',
    shortLabel: 'Debt/Asset',
    description: 'Total debt as percentage of total assets',
    formula: 'totalDebt / totalAssets',
    unit: '%',
    direction: 'lower-is-better',
    thresholds: { greenBound: 0.35, amberBound: 0.50 },
    tip: {
      green: 'Debt-to-asset ratio under 35%. Assets comfortably exceed debts.',
      amber: 'Debt-to-asset 35-50%. Work on reducing debt or building assets.',
      red: 'Debt-to-asset over 50%. More than half your assets are financed by debt.',
    },
    source: 'DBS Financial Health Ratios',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
  {
    id: 'liquid-to-nw',
    label: 'Liquid Assets to Net Worth',
    shortLabel: 'Liquidity',
    description: 'Cash savings as percentage of net worth',
    formula: 'cashSavings / netWorth',
    unit: '%',
    direction: 'higher-is-better',
    thresholds: { greenBound: 0.15, amberBound: 0.10 },
    tip: {
      green: '15%+ of net worth in liquid cash. Good liquidity buffer.',
      amber: '10-15% liquid. Consider increasing accessible cash reserves.',
      red: 'Less than 10% liquid. Wealth is illiquid. May struggle in emergencies.',
    },
    source: 'DBS Financial Health Ratios',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
  {
    id: 'investment-to-nw',
    label: 'Net Investment to Net Worth',
    shortLabel: 'Investment',
    description: 'Invested assets as percentage of net worth',
    formula: 'investedAssets / netWorth',
    unit: '%',
    direction: 'higher-is-better',
    thresholds: { greenBound: 0.50, amberBound: 0.30 },
    tip: {
      green: '50%+ of net worth invested. Assets are working for you.',
      amber: '30-50% invested. Consider deploying more idle cash into investments.',
      red: 'Less than 30% invested. Significant wealth sitting idle.',
    },
    source: 'DBS Financial Health Ratios',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
  {
    id: 'solvency',
    label: 'Solvency Ratio',
    shortLabel: 'Solvency',
    description: 'Net worth as percentage of total assets',
    formula: 'netWorth / totalAssets',
    unit: '%',
    direction: 'higher-is-better',
    thresholds: { greenBound: 0.50, amberBound: 0.35 },
    tip: {
      green: 'Solvency over 50%. You own more than you owe.',
      amber: 'Solvency 35-50%. Debt is significant relative to assets.',
      red: 'Solvency under 35%. High leverage. Focus on debt reduction.',
    },
    source: 'DBS Financial Health Ratios',
    sourceUrl: 'https://www.dbs.com.sg/personal/articles/nav/financial-planning/7-financial-ratios-to-gauge-your-financial-health',
  },
]

/** Lookup map for O(1) access by ratio id */
export const HEALTH_RATIO_LOOKUP: Record<string, HealthRatioMeta> =
  Object.fromEntries(HEALTH_RATIOS.map((r) => [r.id, r]))

/** Insurance multiples for quick-estimate mode.
 * Death/TPD 9x and CI 4x from MoneySense Basic Financial Planning Guide.
 * Disability 65% is an app-specific conservative default — MoneySense guidance
 * says "up to 80% of average monthly salary" but insurers typically cover 60-75%.
 * We use 65% as a middle-ground estimate. Source label says "App default (industry range 60-75%)".
 */
export const INSURANCE_MULTIPLES = {
  deathTpd: 9,
  criticalIllness: 4,
  disabilityIncome: 0.65,
  maxPremiumRatio: 0.15,
} as const

/** Capital Needs default parameters.
 * NOTE: This is app-specific methodology, NOT a direct implementation of LIA's
 * protection gap calculator. Key differences from LIA:
 * - Funeral costs default $15K (LIA uses $10K) — reflects current SG costs
 * - Household expense support stops at spouse retirement (LIA uses lifetime)
 * - Household expenses use income-shortfall approach (expenses minus partner income)
 */
export const CAPITAL_NEEDS_DEFAULTS = {
  funeralCosts: 15_000,
  ciRecoveryYears: 5,
  childIndependenceAge: 25,
  parentLifeExpectancy: 85,
} as const
