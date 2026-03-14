import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SetupScreen, shouldSkipScreen } from '@/components/setup/SetupScreen'
import { ReviewCheckpoint } from '@/components/setup/ReviewCheckpoint'
import { useUIStore } from '@/stores/useUIStore'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import {
  applySetupDraft,
  hydrateSetupFromPlan,
  type SetupDraft,
} from '@/lib/household/setupDraft'
import type { NudgeFlowScreen } from '@/lib/data/nudgeFlows'
import type { HouseholdPlanType } from '@/lib/household/types'
import type { SectionId } from '@/lib/household/sectionOrder'
import { usePageMeta } from '@/hooks/usePageMeta'
import { trackEvent } from '@/lib/analytics'

// ---------------------------------------------------------------------------
// Screen definitions
// ---------------------------------------------------------------------------

const SCREENS: (NudgeFlowScreen & {
  skipWhen?: { field: string; equals?: string | boolean; notEquals?: string | boolean }
  /** Only show for these plan types. Omit to show for all. */
  planTypes?: HouseholdPlanType[]
})[] = [
  // Screen 1: Age
  {
    id: 'age',
    title: 'How old are you?',
    fields: [
      { name: 'currentAge', label: 'Current age', type: 'number', required: true },
      { name: 'retirementAge', label: 'Desired retirement age', type: 'number', required: true },
      {
        name: 'retirementPhase',
        label: 'Retirement phase',
        type: 'select',
        options: [
          { value: 'before-55', label: 'Before 55 (pre-CPF LIFE)' },
          { value: '55-to-64', label: '55 to 64 (CPF drawdown phase)' },
          { value: '65-plus', label: '65 and above (CPF LIFE payouts active)' },
        ],
      },
    ],
  },
  // Screen 2a: Income toggle (already-FIRE pathway: income may be optional)
  {
    id: 'income-toggle',
    title: 'Do you still earn income?',
    fields: [
      { name: 'hasIncome', label: 'I still earn employment or business income', type: 'toggle' },
    ],
  },
  // Screen 2b: Income details (skip if hasIncome is false)
  {
    id: 'income',
    title: 'What do you earn?',
    fields: [
      { name: 'annualIncome', label: 'Annual income', type: 'currency', required: true },
      {
        name: 'incomeType',
        label: 'Income basis',
        type: 'select',
        options: [
          { value: 'gross', label: 'Gross (before tax/CPF)' },
          { value: 'take-home', label: 'Take-home (after deductions)' },
        ],
        required: true,
      },
    ],
    skipWhen: { field: 'hasIncome', equals: false },
  },
  // Screen 3: Expenses
  {
    id: 'expenses',
    title: 'What do you spend?',
    fields: [
      { name: 'annualExpenses', label: 'Annual expenses', type: 'currency', required: true },
    ],
  },
  // Screen 4: Savings
  {
    id: 'savings',
    title: 'What have you saved?',
    fields: [
      { name: 'liquidNetWorth', label: 'Cash & investments (excl. CPF/property)', type: 'currency', required: true },
    ],
  },
  // Screen 5: Residency
  {
    id: 'residency',
    title: 'Are you a Singapore citizen or PR?',
    fields: [
      {
        name: 'residency',
        label: 'Residency status',
        type: 'select',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident (PR)' },
          { value: 'foreigner', label: 'Foreigner' },
        ],
        required: true,
      },
    ],
  },
  // Screen 6: CPF (skip if foreigner)
  {
    id: 'cpf',
    title: 'Your CPF',
    fields: [
      { name: 'cpfKnown', label: 'I know my CPF balances', type: 'toggle' },
      { name: 'cpfTotal', label: 'Total CPF balance (OA + SA + MA)', type: 'currency' },
    ],
    skipWhen: { field: 'residency', equals: 'foreigner' },
  },
  // Screen 7: Property toggle
  {
    id: 'property-toggle',
    title: 'Do you own property?',
    fields: [
      {
        name: 'ownsProperty',
        label: 'Property status',
        type: 'select',
        options: [
          { value: 'owns', label: 'I own property' },
          { value: 'planning', label: 'Planning to buy' },
          { value: 'no', label: 'No property' },
        ],
        required: true,
      },
    ],
  },
  // Screen 8a: Property details — current owner (show only when owns)
  {
    id: 'property-details',
    title: 'Your property',
    fields: [
      {
        name: 'propertyType',
        label: 'Property type',
        type: 'select',
        options: [
          { value: 'hdb', label: 'HDB' },
          { value: 'condo', label: 'Condo' },
          { value: 'landed', label: 'Landed' },
        ],
      },
      { name: 'propertyValue', label: 'Estimated current value', type: 'currency' },
      { name: 'mortgageBalance', label: 'Outstanding mortgage', type: 'currency' },
    ],
    skipWhen: { field: 'ownsProperty', notEquals: 'owns' },
  },
  // Screen 8b: Property details — planning to buy (show only when planning)
  {
    id: 'property-planning',
    title: 'Your future property',
    fields: [
      {
        name: 'propertyType',
        label: 'Property type',
        type: 'select',
        options: [
          { value: 'hdb', label: 'HDB' },
          { value: 'condo', label: 'Condo' },
          { value: 'landed', label: 'Landed' },
        ],
      },
      { name: 'purchasePrice', label: 'Expected purchase price', type: 'currency' },
      { name: 'purchaseYearsFromNow', label: 'Years until purchase', type: 'number' },
    ],
    skipWhen: { field: 'ownsProperty', notEquals: 'planning' },
  },
  // Screen 9: Healthcare toggle
  {
    id: 'healthcare-toggle',
    title: 'Healthcare planning',
    fields: [
      { name: 'healthcareEnabled', label: 'Include healthcare costs in projection', type: 'toggle' },
    ],
  },
  // Screen 10: Healthcare details (skip if disabled)
  {
    id: 'healthcare-details',
    title: 'Healthcare basics',
    fields: [
      {
        name: 'ispTier',
        label: 'Integrated Shield Plan tier',
        type: 'select',
        options: [
          { value: 'none', label: 'None (MediShield Life only)' },
          { value: 'basic', label: 'Basic' },
          { value: 'enhanced', label: 'Enhanced' },
        ],
      },
    ],
    skipWhen: { field: 'healthcareEnabled', equals: false },
  },
  // Screens 11-15: Partner screens (couple/household only)
  {
    id: 'partner-name',
    title: "Your partner's details",
    fields: [
      { name: 'partnerName', label: "Partner's name", type: 'text' },
      { name: 'partnerAge', label: "Partner's current age", type: 'number', required: true },
      { name: 'partnerRetirementAge', label: "Partner's retirement age", type: 'number', required: true },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-income',
    title: "Partner's income",
    fields: [
      { name: 'partnerIncome', label: 'Annual income', type: 'currency', required: true },
      {
        name: 'partnerIncomeType',
        label: 'Income basis',
        type: 'select',
        options: [
          { value: 'gross', label: 'Gross' },
          { value: 'take-home', label: 'Take-home' },
        ],
        required: true,
      },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-expenses',
    title: "Partner's expenses & savings",
    fields: [
      { name: 'partnerExpenses', label: 'Annual personal expenses', type: 'currency', required: true },
      { name: 'partnerNetWorth', label: 'Cash & investments', type: 'currency', required: true },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-residency',
    title: "Partner's residency & CPF",
    fields: [
      {
        name: 'partnerResidency',
        label: 'Residency status',
        type: 'select',
        options: [
          { value: 'citizen', label: 'Singapore Citizen' },
          { value: 'pr', label: 'Permanent Resident' },
          { value: 'foreigner', label: 'Foreigner' },
        ],
        required: true,
      },
      { name: 'partnerCpfKnown', label: 'Partner knows CPF balance', type: 'toggle' },
      { name: 'partnerCpfTotal', label: 'Total CPF balance', type: 'currency' },
    ],
    planTypes: ['couple', 'household'],
  },
  {
    id: 'partner-joint',
    title: 'Joint expenses',
    fields: [
      { name: 'jointMonthlyExpenses', label: 'Additional shared monthly expenses', type: 'currency' },
    ],
    planTypes: ['couple', 'household'],
  },
  // Screen 15: Dependents (couple/household only)
  {
    id: 'dependents',
    title: 'Do you have dependents?',
    fields: [
      { name: 'hasDependents', label: 'I have dependents (children, elderly parents, etc.)', type: 'toggle' },
      { name: 'dependent1Name', label: "Dependent's name", type: 'text' },
      { name: 'dependent1Age', label: "Dependent's age", type: 'number' },
      {
        name: 'dependent1Relationship',
        label: 'Relationship',
        type: 'select',
        options: [
          { value: 'child', label: 'Child' },
          { value: 'parent', label: 'Parent' },
          { value: 'sibling', label: 'Sibling' },
          { value: 'other', label: 'Other' },
        ],
      },
    ],
    planTypes: ['couple', 'household'],
  },
]

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface SetupState {
  screenIndex: number
  values: Record<string, unknown>
}

type SetupAction =
  | { type: 'SET_FIELD'; field: string; value: unknown }
  | { type: 'GO_TO'; index: number }
  | { type: 'HYDRATE'; values: Record<string, unknown> }

function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, values: { ...state.values, ...{ [action.field]: action.value } } }
    case 'GO_TO':
      return { ...state, screenIndex: action.index }
    case 'HYDRATE':
      return { ...state, values: { ...state.values, ...action.values } }
    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const INITIAL_VALUES: Record<string, unknown> = {
  currentAge: 30,
  retirementAge: 55,
  retirementPhase: 'before-55',
  hasIncome: true,
  annualIncome: 72000,
  incomeType: 'gross',
  annualExpenses: 48000,
  liquidNetWorth: 50000,
  residency: 'citizen',
  cpfKnown: false,
  cpfTotal: 0,
  ownsProperty: 'no',
  propertyType: 'condo',
  propertyValue: 0,
  mortgageBalance: 0,
  purchasePrice: 1500000,
  purchaseYearsFromNow: 0,
  healthcareEnabled: false,
  ispTier: 'none',
  // Partner defaults
  partnerName: '',
  partnerAge: 30,
  partnerRetirementAge: 55,
  partnerIncome: 72000,
  partnerIncomeType: 'gross',
  partnerExpenses: 48000,
  partnerNetWorth: 50000,
  partnerResidency: 'citizen',
  partnerCpfKnown: false,
  partnerCpfTotal: 0,
  jointMonthlyExpenses: 0,
  // Dependents defaults
  hasDependents: false,
  dependent1Name: '',
  dependent1Age: 0,
  dependent1Relationship: 'child',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function draftFromValues(values: Record<string, unknown>, planType: HouseholdPlanType, isRedo: boolean): SetupDraft {
  const hasIncome = values.hasIncome !== false
  const draft: SetupDraft = {
    currentAge: values.currentAge as number,
    retirementAge: values.retirementAge as number,
    annualIncome: hasIncome ? (values.annualIncome as number) : 0,
    incomeType: hasIncome ? (values.incomeType as 'gross' | 'take-home') : 'gross',
    annualExpenses: values.annualExpenses as number,
    liquidNetWorth: values.liquidNetWorth as number,
    residency: values.residency as 'citizen' | 'pr' | 'foreigner',
    cpfKnown: values.cpfKnown as boolean,
    cpfTotal: values.cpfKnown ? (values.cpfTotal as number) : undefined,
    ownsProperty: values.ownsProperty as 'owns' | 'planning' | 'no',
    propertyType: values.propertyType as 'hdb' | 'condo' | 'landed' | undefined,
    propertyValue: values.ownsProperty === 'owns' ? (values.propertyValue as number) : undefined,
    mortgageBalance: values.ownsProperty === 'owns' ? (values.mortgageBalance as number) : undefined,
    purchasePrice: values.ownsProperty === 'planning' ? (values.purchasePrice as number) : undefined,
    purchaseYearsFromNow: values.ownsProperty === 'planning' ? (values.purchaseYearsFromNow as number) : undefined,
    healthcareEnabled: values.healthcareEnabled as boolean,
    ispTier: values.healthcareEnabled ? (values.ispTier as 'none' | 'basic' | 'enhanced') : undefined,
    lifeStage: 'pre-fire',
    retirementPhase: values.retirementPhase as 'before-55' | '55-to-64' | '65-plus' | undefined,
    isRedo,
  }

  if (planType !== 'individual') {
    draft.partner = {
      name: values.partnerName as string,
      currentAge: values.partnerAge as number,
      retirementAge: values.partnerRetirementAge as number,
      annualIncome: values.partnerIncome as number,
      incomeType: values.partnerIncomeType as 'gross' | 'take-home',
      annualExpenses: values.partnerExpenses as number,
      liquidNetWorth: values.partnerNetWorth as number,
      residency: values.partnerResidency as 'citizen' | 'pr' | 'foreigner',
      cpfKnown: values.partnerCpfKnown as boolean,
      cpfTotal: values.partnerCpfKnown ? (values.partnerCpfTotal as number) : undefined,
    }
    draft.jointMonthlyExpenses = values.jointMonthlyExpenses as number

    // Dependents (screen 15)
    if (values.hasDependents) {
      const dep1Name = values.dependent1Name as string
      const dep1Age = values.dependent1Age as number
      const dep1Rel = values.dependent1Relationship as string
      if (dep1Name || dep1Age > 0) {
        draft.dependents = [{ name: dep1Name, age: dep1Age, relationship: dep1Rel }]
      }
    }
  }

  return draft
}

function hydrateDraftToValues(draft: SetupDraft): Record<string, unknown> {
  const values: Record<string, unknown> = {
    currentAge: draft.currentAge,
    retirementAge: draft.retirementAge,
    retirementPhase: draft.retirementPhase ?? 'before-55',
    hasIncome: draft.annualIncome > 0,
    annualIncome: draft.annualIncome,
    incomeType: draft.incomeType,
    annualExpenses: draft.annualExpenses,
    liquidNetWorth: draft.liquidNetWorth,
    residency: draft.residency,
    cpfKnown: draft.cpfKnown,
    cpfTotal: draft.cpfTotal ?? 0,
    ownsProperty: draft.ownsProperty,
    propertyType: draft.propertyType ?? 'condo',
    propertyValue: draft.propertyValue ?? 0,
    mortgageBalance: draft.mortgageBalance ?? 0,
    purchasePrice: draft.purchasePrice ?? 1500000,
    purchaseYearsFromNow: draft.purchaseYearsFromNow ?? 0,
    healthcareEnabled: draft.healthcareEnabled,
    ispTier: draft.ispTier ?? 'none',
  }

  if (draft.partner) {
    values.partnerName = draft.partner.name
    values.partnerAge = draft.partner.currentAge
    values.partnerRetirementAge = draft.partner.retirementAge
    values.partnerIncome = draft.partner.annualIncome
    values.partnerIncomeType = draft.partner.incomeType
    values.partnerExpenses = draft.partner.annualExpenses
    values.partnerNetWorth = draft.partner.liquidNetWorth
    values.partnerResidency = draft.partner.residency
    values.partnerCpfKnown = draft.partner.cpfKnown
    values.partnerCpfTotal = draft.partner.cpfTotal ?? 0
  }

  if (draft.jointMonthlyExpenses != null) {
    values.jointMonthlyExpenses = draft.jointMonthlyExpenses
  }

  return values
}

/** Sections that the setup wizard populates. */
function derivePopulatedSections(values: Record<string, unknown>): SectionId[] {
  const sections: SectionId[] = [
    'section-personal',
    'section-income',
    'section-expenses',
    'section-net-worth',
  ]
  if (values.residency !== 'foreigner') {
    sections.push('section-cpf')
  }
  if (values.ownsProperty !== 'no') {
    sections.push('section-property')
  }
  if (values.healthcareEnabled) {
    sections.push('section-healthcare')
  }
  return sections
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SetupPage() {
  usePageMeta({
    title: 'Setup - SG FIRE Planner',
    description: 'Guided setup for your Singapore FIRE plan.',
    path: '/setup',
  })

  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const planType = (searchParams.get('planType') ?? 'individual') as HouseholdPlanType
  const isRedo = searchParams.get('redo') === 'true'
  const sectionOrder = useUIStore((s) => s.sectionOrder)
  const setUIField = useUIStore((s) => s.setField)

  // Filter screens by plan type
  const visibleScreenDefs = useMemo(
    () => SCREENS.filter((s) => !s.planTypes || s.planTypes.includes(planType)),
    [planType],
  )

  const [state, dispatch] = useReducer(setupReducer, {
    screenIndex: 0,
    values: { ...INITIAL_VALUES },
  })

  // Hydrate from existing plan on redo
  useEffect(() => {
    if (!isRedo) return
    try {
      const plan = useHouseholdPlanStore.getState().plan
      const existing = hydrateSetupFromPlan(plan)
      dispatch({ type: 'HYDRATE', values: hydrateDraftToValues(existing) })
    } catch {
      // No existing plan to hydrate from — use defaults
    }
  }, [isRedo])

  // Compute active (non-skipped) screen indices
  const activeScreenIndices = useMemo(
    () =>
      visibleScreenDefs
        .map((screen, i) => ({ screen, i }))
        .filter(({ screen }) => !shouldSkipScreen(screen, state.values))
        .map(({ i }) => i),
    [visibleScreenDefs, state.values],
  )

  const currentActivePosition = activeScreenIndices.indexOf(state.screenIndex)
  const isReview = currentActivePosition === -1 && state.screenIndex >= visibleScreenDefs.length
  const totalSteps = activeScreenIndices.length

  const handleChange = useCallback((field: string, value: unknown) => {
    dispatch({ type: 'SET_FIELD', field, value })
  }, [])

  const handleNext = useCallback(() => {
    const currentPos = activeScreenIndices.indexOf(state.screenIndex)
    if (currentPos < activeScreenIndices.length - 1) {
      // Go to next non-skipped screen
      dispatch({ type: 'GO_TO', index: activeScreenIndices[currentPos + 1] })
    } else {
      // Last screen -> go to review
      dispatch({ type: 'GO_TO', index: visibleScreenDefs.length })
    }
  }, [activeScreenIndices, state.screenIndex, visibleScreenDefs.length])

  const handleBack = useCallback(() => {
    const currentPos = activeScreenIndices.indexOf(state.screenIndex)
    if (currentPos > 0) {
      dispatch({ type: 'GO_TO', index: activeScreenIndices[currentPos - 1] })
    }
  }, [activeScreenIndices, state.screenIndex])

  const handleEdit = useCallback(
    (screenIndex: number) => {
      // Map review category screenIndex to a visible screen. The review
      // checkpoint uses category indices (0=income, 1=expenses, etc.) that
      // don't map 1:1 to SCREENS indices. Find the best matching screen.
      const targetIds = ['income-toggle', 'expenses', 'cpf', 'property-toggle', 'healthcare-toggle', 'partner-name']
      const targetId = targetIds[screenIndex]
      const matchIdx = visibleScreenDefs.findIndex((s) => s.id === targetId)
      if (matchIdx !== -1) {
        dispatch({ type: 'GO_TO', index: matchIdx })
      } else {
        dispatch({ type: 'GO_TO', index: 0 })
      }
    },
    [visibleScreenDefs],
  )

  const handleConfirm = useCallback(() => {
    const draft = draftFromValues(state.values, planType, isRedo)

    // Already-fire pathway: override life stage and retirement age
    if (sectionOrder === 'already-fire') {
      draft.lifeStage = 'post-fire'
      draft.retirementAge = draft.currentAge
    }

    applySetupDraft(draft, planType)

    // Mark setup as completed in UIStore
    setUIField('setupCompleted', true)
    setUIField('setupPopulatedSections', derivePopulatedSections(state.values))

    trackEvent('setup_completed', { planType, isRedo, pathway: sectionOrder })
    navigate('/projection')
  }, [state.values, planType, isRedo, sectionOrder, setUIField, navigate])

  // Abandonment guard for couple flows
  useEffect(() => {
    if (planType === 'individual') return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [planType])

  // Review screen
  if (isReview) {
    const draft = draftFromValues(state.values, planType, isRedo)
    return (
      <ReviewCheckpoint
        draft={draft}
        onConfirm={handleConfirm}
        onEdit={handleEdit}
      />
    )
  }

  // Normal screen
  const currentScreen = visibleScreenDefs[state.screenIndex]
  if (!currentScreen) {
    // Safety: shouldn't happen
    return null
  }

  const isFirstScreen = currentActivePosition === 0

  return (
    <SetupScreen
      screen={currentScreen}
      values={state.values}
      onChange={handleChange}
      onNext={handleNext}
      onBack={isFirstScreen ? undefined : handleBack}
      currentStep={currentActivePosition + 1}
      totalSteps={totalSteps}
      submitLabel={
        currentActivePosition === totalSteps - 1 ? 'Review your answers' : 'Continue'
      }
    />
  )
}
