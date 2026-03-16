export interface RetirementTemplate {
  id: 'frugal' | 'active' | 'none'
  label: string
  description: string
  multipliers: Record<string, number>
}

export const RETIREMENT_TEMPLATES: RetirementTemplate[] = [
  {
    id: 'frugal',
    label: 'Frugal Retiree',
    description: 'Minimal spending. Less dining out, public transport, home-based leisure.',
    multipliers: {
      rent: 0.8, food: 0.85, transport: 0.4, utilities: 0.8,
      entertainment: 0.5, travel: 0.3, other: 0.7,
    },
  },
  {
    id: 'active',
    label: 'Active Retiree',
    description: 'Travel more, eat well, enjoy hobbies. Cut commuting and work expenses.',
    multipliers: {
      rent: 1.0, food: 1.0, transport: 0.6, utilities: 0.9,
      entertainment: 1.2, travel: 1.5, other: 0.9,
    },
  },
  {
    id: 'none',
    label: 'No Change',
    description: 'Keep current spending patterns into retirement.',
    multipliers: {
      rent: 1.0, food: 1.0, transport: 1.0, utilities: 1.0,
      entertainment: 1.0, travel: 1.0, other: 1.0,
    },
  },
]

/** Category keys in display order */
export const EXPENSE_CATEGORY_KEYS = [
  'rent', 'food', 'transport', 'utilities', 'entertainment', 'travel', 'other',
] as const

export type ExpenseCategoryKey = typeof EXPENSE_CATEGORY_KEYS[number]

/** Map nudge flow field names to canonical category keys */
export const FLOW_FIELD_TO_CATEGORY: Record<string, ExpenseCategoryKey> = {
  housingExpenses: 'rent',
  foodExpenses: 'food',
  transportExpenses: 'transport',
  utilitiesExpenses: 'utilities',
  entertainmentExpenses: 'entertainment',
  travelExpenses: 'travel',
  otherExpenses: 'other',
}

export const CATEGORY_TO_FLOW_FIELD: Record<ExpenseCategoryKey, string> = {
  rent: 'housingExpenses',
  food: 'foodExpenses',
  transport: 'transportExpenses',
  utilities: 'utilitiesExpenses',
  entertainment: 'entertainmentExpenses',
  travel: 'travelExpenses',
  other: 'otherExpenses',
}
