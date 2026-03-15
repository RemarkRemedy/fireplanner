import { CheckCircle2, MinusCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SetupDraft } from '@/lib/household/setupDraft'

type CategoryStatus = 'provided' | 'not-applicable' | 'excluded'

interface ReviewCategory {
  key: string
  label: string
  status: CategoryStatus
  detail: string
  screenIndex: number
}

interface ReviewCheckpointProps {
  draft: SetupDraft
  onConfirm: () => void
  onEdit: (screenIndex: number) => void
  validationError?: string | null
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${Math.round(value / 1_000)}K`
  }
  return `$${value.toLocaleString('en-SG')}`
}

function StatusIcon({ status }: { status: CategoryStatus }) {
  if (status === 'provided') {
    return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
  }
  if (status === 'not-applicable') {
    return <MinusCircle className="h-5 w-5 text-muted-foreground shrink-0" />
  }
  // 'excluded' — valid user choice, not an error
  return <Info className="h-5 w-5 text-muted-foreground shrink-0" />
}

function deriveCategories(draft: SetupDraft): ReviewCategory[] {
  const categories: ReviewCategory[] = []

  // Age & retirement target
  const yearsToGo = draft.retirementAge - draft.currentAge
  categories.push({
    key: 'age',
    label: 'Age & target',
    status: 'provided',
    detail: `Age ${draft.currentAge}, retire at ${draft.retirementAge} (${yearsToGo > 0 ? `${yearsToGo} years to go` : 'already there'})`,
    screenIndex: 0,
  })

  // Income & savings: always provided
  categories.push({
    key: 'income',
    label: 'Income & savings',
    status: 'provided',
    detail: `${formatCurrency(draft.annualIncome)}/yr income, ${formatCurrency(draft.liquidNetWorth)} cash & investments`,
    screenIndex: 1,
  })

  // Expenses: always provided
  categories.push({
    key: 'expenses',
    label: 'Expenses',
    status: 'provided',
    detail: `${formatCurrency(draft.annualExpenses)}/yr`,
    screenIndex: 2,
  })

  // CPF
  let cpfStatus: CategoryStatus
  let cpfDetail: string
  if (draft.residency === 'foreigner') {
    cpfStatus = 'not-applicable'
    cpfDetail = 'Not applicable — foreigner'
  } else if (draft.cpfKnown && draft.cpfTotal != null) {
    cpfStatus = 'provided'
    cpfDetail = `Total CPF: ${formatCurrency(draft.cpfTotal)}`
  } else {
    cpfStatus = 'excluded'
    cpfDetail = 'CPF balance not entered — estimates will be used'
  }
  categories.push({
    key: 'cpf',
    label: 'CPF',
    status: cpfStatus,
    detail: cpfDetail,
    screenIndex: 3,
  })

  // Property
  let propertyStatus: CategoryStatus
  let propertyDetail: string
  if (draft.ownsProperty === 'no') {
    propertyStatus = 'excluded'
    propertyDetail = 'No property — not included in projection'
  } else if (draft.ownsProperty === 'owns' && draft.propertyValue != null) {
    propertyStatus = 'provided'
    propertyDetail = `${formatCurrency(draft.propertyValue)} estimated value`
  } else if (draft.ownsProperty === 'planning' && draft.purchasePrice != null) {
    propertyStatus = 'provided'
    propertyDetail = `Planning to buy: ${formatCurrency(draft.purchasePrice)}`
  } else {
    propertyStatus = 'excluded'
    propertyDetail = 'Property details not provided'
  }
  categories.push({
    key: 'property',
    label: 'Property',
    status: propertyStatus,
    detail: propertyDetail,
    screenIndex: 4,
  })

  // Healthcare
  let healthcareStatus: CategoryStatus
  let healthcareDetail: string
  if (draft.healthcareEnabled) {
    healthcareStatus = 'provided'
    healthcareDetail = draft.ispTier != null && draft.ispTier !== 'none'
      ? `ISP tier: ${draft.ispTier}`
      : 'MediShield Life only'
  } else {
    healthcareStatus = 'excluded'
    healthcareDetail = 'Healthcare costs excluded from projection'
  }
  categories.push({
    key: 'healthcare',
    label: 'Healthcare',
    status: healthcareStatus,
    detail: healthcareDetail,
    screenIndex: 5,
  })

  // Partner (only if present)
  if (draft.partner) {
    categories.push({
      key: 'partner',
      label: 'Partner',
      status: 'provided',
      detail: `${draft.partner.name || 'Partner'}, age ${draft.partner.currentAge}, ${formatCurrency(draft.partner.annualIncome)}/yr`,
      screenIndex: 6,
    })
  }

  return categories
}

export function ReviewCheckpoint({ draft, onConfirm, onEdit, validationError }: ReviewCheckpointProps) {
  const categories = deriveCategories(draft)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Review your inputs</h2>
        <p className="text-sm text-muted-foreground">
          All done! Check that everything looks right before we generate your projection.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {categories.map((category) => (
          <Card key={category.key}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <StatusIcon status={category.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{category.label}</p>
                  <p className="text-xs text-muted-foreground">{category.detail}</p>
                </div>
                {category.status !== 'not-applicable' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(category.screenIndex)}
                    className="shrink-0 text-xs h-7 px-2"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Savings rate insight */}
      {draft.annualIncome > 0 && draft.annualExpenses > 0 && (
        (() => {
          const monthlySavings = Math.round((draft.annualIncome - draft.annualExpenses) / 12)
          const savingsRate = Math.round(((draft.annualIncome - draft.annualExpenses) / draft.annualIncome) * 100)
          if (savingsRate > 0) {
            return (
              <p className="text-sm text-muted-foreground text-center">
                You&apos;re saving ~{formatCurrency(monthlySavings)}/month ({savingsRate}% of income).
              </p>
            )
          }
          if (savingsRate <= 0) {
            return (
              <p className="text-sm text-muted-foreground text-center">
                Your expenses exceed your income. The projection will show when savings run out.
              </p>
            )
          }
          return null
        })()
      )}

      {validationError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {validationError}
        </div>
      )}
      <Button onClick={onConfirm} className="w-full" size="lg">
        Looks good — See your projection
      </Button>
    </div>
  )
}
