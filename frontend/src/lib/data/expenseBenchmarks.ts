/** Singapore monthly expense benchmarks by life stage, for setup wizard guidance */
export const SG_EXPENSE_BENCHMARKS = [
  { label: 'Single, renting', range: '$2,000-3,500/mo' },
  { label: 'Couple with HDB', range: '$3,000-5,000/mo' },
  { label: 'Family with kids', range: '$5,000-8,000/mo' },
] as const

/**
 * SingStat HES 2023 median monthly household expenditure.
 * Used as an expense baseline for deriving approximate savings rates.
 * Source: Singapore Department of Statistics, Household Expenditure Survey 2023
 */
export const SINGSTAT_MEDIAN_MONTHLY_EXPENSES = 5200

/** Per-category monthly expense benchmarks for Singapore middle-income households.
 *  Source: SingStat Household Expenditure Survey + MoneySense guidelines. */
export const EXPENSE_CATEGORY_BENCHMARKS: Record<string, { label: string; range: string }> = {
  rent:          { label: 'Rent',          range: '$800-2,500/mo' },
  food:          { label: 'Food & dining', range: '$400-800/mo' },
  transport:     { label: 'Transport',     range: '$150-400/mo' },
  utilities:     { label: 'Utilities',     range: '$100-250/mo' },
  entertainment: { label: 'Entertainment', range: '$100-400/mo' },
  travel:        { label: 'Travel',        range: '$100-500/mo' },
  other:         { label: 'Other',         range: '$100-300/mo' },
}
