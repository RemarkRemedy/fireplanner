import type { SectionId } from '@/lib/household/sectionOrder'

export type NudgeFlowId =
  | 'cpf'
  | 'expenses'
  | 'property'
  | 'healthcare'
  | 'salary'
  | 'srs'
  | 'goals'
  | 'allocation'
  | 'protection'

export type NudgeContainer = 'full-page' | 'drawer'

export interface NudgeField {
  name: string
  label: string
  type: 'text' | 'number' | 'currency' | 'percent' | 'select' | 'toggle' | 'pill' | 'radio-cards'
  options?: Array<{ value: string; label: string }>
  required?: boolean
  /** Only show this field when another field has this value */
  showWhen?: { field: string; equals?: boolean | string; greaterThanOrEqual?: number }
  /** Helper text shown below the field */
  helperText?: string
  /** Field name for validation lookup — maps to validateSetupField. Defaults to `name`. */
  validationKey?: string
  /** Tooltip text shown via InfoTooltip (i) icon next to the label */
  tooltip?: string
}

export interface NudgeFlowScreen {
  id: string
  title: string
  subtitle?: string
  fields: NudgeField[]
  skipWhen?: { field: string; equals?: string | boolean; notEquals?: string | boolean }
}

export interface NudgeFlowDefinition {
  id: NudgeFlowId
  label: string
  description: string
  estimatedMinutes: number
  container: NudgeContainer
  explanation: string
  screens: NudgeFlowScreen[]
}

export const NUDGE_TO_SECTION: Record<NudgeFlowId, SectionId> = {
  cpf: 'section-cpf',
  expenses: 'section-expenses',
  property: 'section-property',
  healthcare: 'section-healthcare',
  salary: 'section-income',
  srs: 'section-net-worth',
  goals: 'section-expenses',  // goals are inside the combined spending section
  allocation: 'section-allocation',
  protection: 'section-protection',
}

/** Static priority — ordered by typical impact on FIRE timeline */
export const NUDGE_PRIORITY: NudgeFlowId[] = [
  'salary',      // income growth is the biggest lever on FIRE age
  'expenses',    // retirement spending adjustment is second
  'cpf',         // LIFE payouts + per-account balances affect post-65
  'property',    // equity and downsizing plans
  'healthcare',  // grows with age but smaller absolute impact
  'srs',         // tax relief, supplementary
  'goals',       // one-off future expenses
  'allocation',  // template choice, most accept defaults
  'protection',  // safety net, doesn't shift FIRE timeline
]

const CPF_FLOW: NudgeFlowDefinition = {
  id: 'cpf',
  label: 'CPF Details',
  description: 'Unlock a more accurate projection by including your CPF balances and LIFE payouts.',
  estimatedMinutes: 5,
  container: 'full-page',
  explanation:
    'CPF is a major retirement asset for most Singaporeans. Accurate balances and payout settings significantly improve projection accuracy.',
  screens: [
    {
      id: 'cpf-accounts',
      title: 'CPF Account Balances',
      fields: [
        { name: 'cpfOA', label: 'Ordinary Account (OA)', type: 'currency', required: true, validationKey: 'cpfOA', tooltip: 'Used for housing, education, and investment. Earns 2.5% interest.', helperText: 'Check your CPF statement or my.cpf.gov.sg' },
        { name: 'cpfSA', label: 'Special Account (SA)', type: 'currency', required: true, validationKey: 'cpfSA', tooltip: 'For retirement. Earns 4% interest. Cannot be withdrawn before 55.', helperText: 'Check your CPF statement or my.cpf.gov.sg' },
        { name: 'cpfMA', label: 'MediSave Account (MA)', type: 'currency', required: true, validationKey: 'cpfMA', tooltip: 'For healthcare expenses. Capped at Basic Healthcare Sum ($79,000 in 2026).', helperText: 'Check your CPF statement or my.cpf.gov.sg' },
        { name: 'cpfRA', label: 'Retirement Account (RA)', type: 'currency', validationKey: 'cpfRA', tooltip: 'Created at age 55 from SA and OA transfers. Funds CPF LIFE payouts.', showWhen: { field: 'currentAge', greaterThanOrEqual: 55 } },
      ],
    },
    {
      id: 'cpf-top-ups',
      title: 'Voluntary CPF Top-Ups',
      fields: [
        {
          name: 'hasCpfTopUps',
          label: 'Do you make voluntary CPF top-ups (RSTU/MediSave)?',
          type: 'toggle',
        },
        {
          name: 'annualSaTopUp',
          label: 'Annual SA/RA top-up amount',
          type: 'currency',
          validationKey: 'annualSaTopUp',
          tooltip: 'Voluntary top-ups to SA/RA. Tax-deductible up to $8,000/year.',
        },
        {
          name: 'annualMaTopUp',
          label: 'Annual MediSave top-up amount',
          type: 'currency',
          validationKey: 'annualMaTopUp',
        },
      ],
      skipWhen: { field: 'hasCpfTopUps', equals: false },
    },
    {
      id: 'cpf-life',
      title: 'CPF LIFE Plan',
      fields: [
        {
          name: 'cpfLifePlan',
          label: 'CPF LIFE plan preference',
          type: 'select',
          options: [
            { value: 'standard', label: 'Standard Plan (higher monthly, lower bequest)' },
            { value: 'basic', label: 'Basic Plan (lower monthly, higher bequest)' },
            { value: 'escalating', label: 'Escalating Plan (3% annual increase)' },
          ],
          required: true,
        },
        {
          name: 'cpfPayoutStartAge',
          label: 'CPF LIFE payout start age',
          type: 'number',
          required: true,
        },
      ],
    },
    {
      id: 'cpf-investment',
      title: 'CPF Investment Scheme (CPFIS)',
      fields: [
        {
          name: 'hasCpfis',
          label: 'Do you invest through CPFIS?',
          type: 'toggle',
        },
      ],
      skipWhen: { field: 'hasCpfis', equals: false },
    },
  ],
}

const PROPERTY_FLOW: NudgeFlowDefinition = {
  id: 'property',
  label: 'Property Details',
  description: 'See how your mortgage, rental income, or downsizing plans impact your net worth.',
  estimatedMinutes: 5,
  container: 'full-page',
  explanation:
    'Property equity is often the largest asset outside CPF. Capturing mortgage obligations and future plans improves your net worth and FIRE timeline accuracy.',
  screens: [
    {
      id: 'property-details',
      title: 'Property Details',
      fields: [
        {
          name: 'propertyType',
          label: 'Property type',
          type: 'select',
          options: [
            { value: 'hdb', label: 'HDB Flat' },
            { value: 'condo', label: 'Private Condo / EC' },
            { value: 'landed', label: 'Landed Property' },
          ],
          required: true,
        },
        { name: 'propertyValue', label: 'Current estimated value', type: 'currency', required: true, tooltip: 'Current market value. Check recent HDB or URA transactions.', helperText: 'Check recent HDB or URA transactions' },
        { name: 'leaseStartYear', label: 'Lease start year', type: 'number',
          showWhen: { field: 'propertyType', equals: 'hdb' } },
        {
          name: 'leaseTenure',
          label: 'Lease tenure (years)',
          type: 'select',
          options: [
            { value: '99', label: '99 years' },
            { value: '999', label: '999 years' },
            { value: 'freehold', label: 'Freehold' },
          ],
        },
      ],
    },
    {
      id: 'property-mortgage',
      title: 'Mortgage',
      fields: [
        {
          name: 'hasMortgage',
          label: 'Do you have an outstanding mortgage?',
          type: 'toggle',
        },
        { name: 'mortgageOutstanding', label: 'Outstanding loan amount', type: 'currency', tooltip: 'Remaining loan principal.' },
        { name: 'monthlyMortgagePayment', label: 'Monthly repayment', type: 'currency', tooltip: 'Your monthly mortgage repayment amount.' },
        { name: 'mortgageRatePercent', label: 'Mortgage interest rate (%)', type: 'percent', validationKey: 'mortgageRatePercent', tooltip: 'Current annual interest rate on your mortgage.' },
        { name: 'mortgageEndYear', label: 'Loan end year', type: 'number' },
      ],
    },
    {
      id: 'property-downsizing',
      title: 'Downsizing Plans',
      fields: [
        {
          name: 'planToDownsize',
          label: 'Do you plan to downsize or sell this property?',
          type: 'toggle',
        },
        { name: 'downsizeYear', label: 'Planned year of sale', type: 'number' },
        { name: 'downsizeProceedsPercent', label: 'Proceeds to invest (%)', type: 'percent' },
        { name: 'replacementPropertyCost', label: 'Replacement property cost', type: 'currency' },
      ],
      skipWhen: { field: 'planToDownsize', equals: false },
    },
    {
      id: 'property-rental',
      title: 'Rental Income',
      fields: [
        {
          name: 'hasRentalIncome',
          label: 'Do you earn rental income from this property?',
          type: 'toggle',
        },
        { name: 'monthlyRentalIncome', label: 'Monthly rental income', type: 'currency' },
        { name: 'rentalExpensesPercent', label: 'Annual expenses as % of rental income', type: 'percent' },
        { name: 'rentalIncomeEndYear', label: 'Rental income end year (optional)', type: 'number' },
      ],
      skipWhen: { field: 'hasRentalIncome', equals: false },
    },
  ],
}

const EXPENSES_FLOW: NudgeFlowDefinition = {
  id: 'expenses',
  label: 'Expense Breakdown',
  description: 'Break down your spending to model post-retirement expense changes more accurately.',
  estimatedMinutes: 4,
  container: 'full-page',
  explanation:
    'Knowing how your spending is allocated lets us model post-retirement expense changes more accurately (e.g., reduced commuting costs, healthcare increasing with age).',
  screens: [
    {
      id: 'expenses-breakdown',
      title: 'Monthly Expense Categories',
      fields: [
        { name: 'housingExpenses', label: 'Housing (rent/mortgage)', type: 'currency' },
        { name: 'foodExpenses', label: 'Food & dining', type: 'currency' },
        { name: 'transportExpenses', label: 'Transport', type: 'currency' },
        { name: 'utilitiesExpenses', label: 'Utilities & bills', type: 'currency' },
        { name: 'entertainmentExpenses', label: 'Entertainment & leisure', type: 'currency' },
        { name: 'travelExpenses', label: 'Travel (annualised)', type: 'currency' },
        { name: 'otherExpenses', label: 'Other expenses', type: 'currency' },
      ],
    },
    {
      id: 'expenses-retirement-adjustment',
      title: 'Retirement Spending Adjustment',
      fields: [
        {
          name: 'retirementSpendingRatio',
          label: 'Expected spending in retirement vs. now (%)',
          type: 'percent',
          required: true,
          tooltip: '100% = same spending as now. Most retirees spend 70-80% (no commute, paid-off mortgage). Some spend more early in retirement (travel).',
          helperText: 'Enter 100 to keep current spending. Enter 80 if you expect to spend 20% less.',
        },
      ],
    },
    {
      id: 'expenses-goals',
      title: 'Large Future Expenses',
      fields: [
        {
          name: 'hasLargeGoals',
          label: 'Do you have large one-off future expenses (wedding, education, renovation)?',
          type: 'toggle',
        },
        { name: 'goalName', label: 'Goal name', type: 'text' },
        { name: 'goalAmount', label: 'Target amount', type: 'currency' },
        { name: 'goalYear', label: 'Target year', type: 'number' },
      ],
      skipWhen: { field: 'hasLargeGoals', equals: false },
    },
  ],
}

const HEALTHCARE_FLOW: NudgeFlowDefinition = {
  id: 'healthcare',
  label: 'Healthcare Coverage',
  description: 'Factor in ISP premiums and MediSave to prevent medical costs from derailing your plan.',
  estimatedMinutes: 3,
  container: 'full-page',
  explanation:
    'Healthcare is one of the largest retirement expenses in Singapore. Capturing your ISP tier and MediSave balance improves long-term cost projections.',
  screens: [
    {
      id: 'healthcare-isp',
      title: 'Integrated Shield Plan (ISP)',
      fields: [
        {
          name: 'ispTier',
          label: 'ISP tier',
          type: 'select',
          options: [
            { value: 'none', label: 'No ISP (MediShield Life only)' },
            { value: 'basic', label: 'Basic (Class B1 ward)' },
            { value: 'standard', label: 'Standard (Class A ward)' },
            { value: 'enhanced', label: 'Enhanced (Private hospital)' },
          ],
          required: true,
          tooltip: 'Basic = Class B1 ward. Standard = Class A ward. Enhanced = private hospital.',
        },
        {
          name: 'hasRider',
          label: 'Do you have an ISP rider (reduces co-payments)?',
          type: 'toggle',
        },
        { name: 'annualIspPremium', label: 'Current annual ISP premium', type: 'currency' },
      ],
    },
    {
      id: 'healthcare-medisave',
      title: 'MediSave',
      fields: [
        {
          name: 'mediSaveBalance',
          label: 'Current MediSave balance',
          type: 'currency',
          required: true,
          tooltip: 'Current MediSave (MA) balance. Used for premiums and hospital bills.',
        },
        {
          name: 'mediSaveTopUpAnnual',
          label: 'Annual voluntary MediSave top-up',
          type: 'currency',
        },
        {
          name: 'useMediSaveForPremiums',
          label: 'Use MediSave to pay ISP premiums?',
          type: 'toggle',
        },
      ],
    },
    {
      id: 'healthcare-careshield',
      title: 'CareShield Life',
      fields: [
        {
          name: 'careShieldEnrolled',
          label: 'Enrolled in CareShield Life?',
          type: 'toggle',
          required: true,
        },
        {
          name: 'careShieldSupplementPlan',
          label: 'CareShield Life supplement plan',
          type: 'select',
          options: [
            { value: 'none', label: 'No supplement' },
            { value: 'careshield-plus', label: 'CareShield Life Plus' },
            { value: 'private-ltd', label: 'Private LTD supplement' },
          ],
        },
        { name: 'annualCareShieldPremium', label: 'Annual CareShield Life premium', type: 'currency' },
      ],
    },
  ],
}

const SALARY_FLOW: NudgeFlowDefinition = {
  id: 'salary',
  label: 'Salary Model',
  description: 'Model your income growth to see its compound effect on your FIRE date.',
  estimatedMinutes: 2,
  container: 'drawer',
  explanation:
    'A more realistic salary model improves CPF contribution estimates and FIRE timeline accuracy, especially for younger users with decades of career growth ahead.',
  screens: [
    {
      id: 'salary-model',
      title: 'Salary Growth Model',
      fields: [
        {
          name: 'salaryModel',
          label: 'How should we project your salary?',
          type: 'select',
          options: [
            { value: 'simple', label: 'Simple flat growth rate' },
            { value: 'realistic', label: 'Realistic career phases (promotions + plateaus)' },
            { value: 'mom', label: 'MOM benchmark (data-driven by education/age)' },
          ],
          required: true,
          tooltip: 'Simple = fixed annual growth. Realistic = career phases with promotion jumps. Data-driven = MOM salary benchmarks.',
        },
        { name: 'annualSalaryGrowthPercent', label: 'Annual salary growth rate (%)', type: 'percent', showWhen: { field: 'salaryModel', equals: 'simple' } },
      ],
    },
    {
      id: 'salary-growth-details',
      title: 'Bonus & Variable Pay',
      fields: [
        { name: 'annualBonusMonths', label: 'Annual bonus (months of salary)', type: 'number' },
        { name: 'variablePayPercent', label: 'Variable pay as % of base salary', type: 'percent' },
        {
          name: 'salaryStopYear',
          label: 'Year salary stops (if taking a career break or early retirement)',
          type: 'number',
        },
      ],
    },
  ],
}

const SRS_FLOW: NudgeFlowDefinition = {
  id: 'srs',
  label: 'SRS Contributions',
  description: 'Model SRS tax relief and withdrawals for a more complete retirement picture.',
  estimatedMinutes: 2,
  container: 'drawer',
  explanation:
    'SRS contributions reduce taxable income dollar-for-dollar (up to $15,300/year for Singapore Citizens/PRs). Withdrawals at retirement are 50% taxable, making SRS highly efficient for high earners.',
  screens: [
    {
      id: 'srs-toggle',
      title: 'SRS Contributions',
      fields: [
        {
          name: 'contributeToSrs',
          label: 'Do you contribute to the SRS?',
          type: 'toggle',
          required: true,
        },
        { name: 'srsBalance', label: 'Current SRS balance', type: 'currency', tooltip: 'Supplementary Retirement Scheme balance. Contributions are tax-deductible.' },
      ],
    },
    {
      id: 'srs-details',
      title: 'SRS Contribution Details',
      fields: [
        { name: 'annualSrsContribution', label: 'Annual SRS contribution', type: 'currency', required: true, validationKey: 'annualSrsContribution', tooltip: 'Annual SRS contribution. Capped at $15,300 for Singapore citizens/PRs.' },
        {
          name: 'srsInvestmentStrategy',
          label: 'How are SRS funds invested?',
          type: 'select',
          options: [
            { value: 'cash', label: 'Cash / fixed deposits (default)' },
            { value: 'etf', label: 'ETFs / unit trusts' },
            { value: 'stocks', label: 'Individual stocks' },
            { value: 'mixed', label: 'Mixed' },
          ],
        },
        { name: 'srsWithdrawalStartAge', label: 'Planned SRS withdrawal start age', type: 'number' },
      ],
      skipWhen: { field: 'contributeToSrs', equals: false },
    },
  ],
}

const GOALS_FLOW: NudgeFlowDefinition = {
  id: 'goals',
  label: 'Financial Goals',
  description: 'Add lump-sum future expenses that could shift your FIRE timeline.',
  estimatedMinutes: 2,
  container: 'drawer',
  explanation:
    'Goals like a home purchase, child education, or dream holiday are lump-sum cash outflows that affect your FIRE timeline. Capturing them gives a more realistic projection.',
  screens: [
    {
      id: 'goals-add',
      title: 'Add a Financial Goal',
      fields: [
        { name: 'goalName', label: 'Goal name', type: 'text', required: true },
        {
          name: 'goalCategory',
          label: 'Category',
          type: 'select',
          options: [
            { value: 'property', label: 'Property' },
            { value: 'education', label: 'Education' },
            { value: 'travel', label: 'Travel' },
            { value: 'wedding', label: 'Wedding' },
            { value: 'renovation', label: 'Renovation' },
            { value: 'vehicle', label: 'Vehicle' },
            { value: 'charity', label: 'Charity / donation' },
            { value: 'other', label: 'Other' },
          ],
          required: true,
        },
        { name: 'goalTargetAmount', label: 'Target amount', type: 'currency', required: true },
        { name: 'goalTargetYear', label: 'Target year', type: 'number', required: true },
        { name: 'goalCurrentSavings', label: 'Amount already saved toward this goal', type: 'currency' },
      ],
    },
  ],
}

const ALLOCATION_FLOW: NudgeFlowDefinition = {
  id: 'allocation',
  label: 'Investment Allocation',
  description: 'Your asset mix is the biggest driver of long-term returns and volatility.',
  estimatedMinutes: 2,
  container: 'drawer',
  explanation:
    'Asset allocation is the biggest driver of long-term returns and volatility. Getting this right matters more than picking individual investments.',
  screens: [
    {
      id: 'allocation-template',
      title: 'Allocation Template',
      fields: [
        {
          name: 'allocationTemplate',
          label: 'Starting allocation template',
          type: 'select',
          options: [
            { value: 'conservative', label: 'Conservative (30/70 equity/bonds)' },
            { value: 'balanced', label: 'Balanced (60/40 equity/bonds)' },
            { value: 'aggressive', label: 'Aggressive (80/20 equity/bonds)' },
            { value: 'custom', label: 'Custom (I will set weights manually)' },
          ],
          required: true,
        },
        {
          name: 'rebalancingFrequency',
          label: 'Rebalancing frequency',
          type: 'select',
          options: [
            { value: 'annual', label: 'Annual' },
            { value: 'semi-annual', label: 'Semi-annual' },
            { value: 'quarterly', label: 'Quarterly' },
          ],
        },
      ],
    },
    {
      id: 'allocation-glide-path',
      title: 'Glide Path',
      fields: [
        {
          name: 'enableGlidePath',
          label: 'Enable age-based glide path (shift to bonds as you approach retirement)?',
          type: 'toggle',
        },
        { name: 'glidePathStartAge', label: 'Glide path start age', type: 'number' },
        { name: 'glidePathEndAge', label: 'Glide path end age (fully conservative)', type: 'number' },
        {
          name: 'glidePathEndTemplate',
          label: 'Target allocation at end age',
          type: 'select',
          options: [
            { value: 'conservative', label: 'Conservative (30/70)' },
            { value: 'very-conservative', label: 'Very Conservative (10/90)' },
          ],
        },
      ],
    },
  ],
}

const PROTECTION_FLOW: NudgeFlowDefinition = {
  id: 'protection',
  label: 'Protection & Debt',
  description: 'Calculate your true net worth by factoring in emergency funds, loans, and insurance.',
  estimatedMinutes: 3,
  container: 'drawer',
  explanation:
    'Adequate emergency reserves and insurance protect your FIRE plan from being derailed by unexpected events. Outstanding debt reduces your effective net worth.',
  screens: [
    {
      id: 'protection-emergency',
      title: 'Emergency Fund',
      fields: [
        { name: 'emergencyFundBalance', label: 'Emergency fund balance', type: 'currency', required: true, tooltip: 'Cash savings for emergencies. Recommended 3-6 months of expenses.', helperText: 'Cash savings set aside for emergencies' },
        {
          name: 'emergencyFundTarget',
          label: 'Target emergency fund (months of expenses)',
          type: 'number',
        },
        {
          name: 'emergencyFundType',
          label: 'Where is the emergency fund held?',
          type: 'select',
          options: [
            { value: 'savings-account', label: 'Savings account' },
            { value: 'fixed-deposit', label: 'Fixed deposit' },
            { value: 'money-market', label: 'Money market fund' },
            { value: 'mixed', label: 'Mixed' },
          ],
        },
      ],
    },
    {
      id: 'protection-debt',
      title: 'Outstanding Debt',
      fields: [
        { name: 'hasOutstandingDebt', label: 'Do you have outstanding debt (excluding mortgage)?', type: 'toggle' },
        { name: 'carLoanOutstanding', label: 'Car loan outstanding', type: 'currency' },
        { name: 'studentLoanOutstanding', label: 'Student loan outstanding', type: 'currency' },
        { name: 'personalLoanOutstanding', label: 'Personal loan outstanding', type: 'currency' },
        { name: 'creditCardDebt', label: 'Credit card debt', type: 'currency' },
        { name: 'otherDebt', label: 'Other debt', type: 'currency' },
      ],
    },
    {
      id: 'protection-insurance',
      title: 'Insurance Coverage',
      fields: [
        { name: 'lifeCoverageAmount', label: 'Life insurance coverage amount', type: 'currency', tooltip: 'Total death benefit from term life or whole life insurance.' },
        { name: 'ciCoverageAmount', label: 'Critical illness coverage amount', type: 'currency', tooltip: 'Critical illness lump sum payout amount.' },
        { name: 'disabilityCoverageMonthly', label: 'Disability income monthly benefit', type: 'currency' },
        {
          name: 'hasTermLife',
          label: 'Do you have term life insurance?',
          type: 'toggle',
        },
        { name: 'annualInsurancePremiums', label: 'Total annual insurance premiums', type: 'currency' },
      ],
    },
  ],
}

export const NUDGE_FLOWS: NudgeFlowDefinition[] = [
  CPF_FLOW,
  PROPERTY_FLOW,
  EXPENSES_FLOW,
  HEALTHCARE_FLOW,
  SALARY_FLOW,
  SRS_FLOW,
  GOALS_FLOW,
  ALLOCATION_FLOW,
  PROTECTION_FLOW,
]

export function getNudgeFlow(id: NudgeFlowId): NudgeFlowDefinition | undefined {
  return NUDGE_FLOWS.find((f) => f.id === id)
}

export function getFullPageFlowIds(): NudgeFlowId[] {
  return NUDGE_FLOWS.filter((f) => f.container === 'full-page').map((f) => f.id)
}
