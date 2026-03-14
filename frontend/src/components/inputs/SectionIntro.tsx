import { X } from 'lucide-react'
import { getSectionGuide } from '@/lib/data/fieldGuide'
import type { SectionId } from '@/lib/household/sectionOrder'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'

interface SectionIntroProps {
  sectionId: SectionId
}

function fillTemplate(template: string, selfAdult: ReturnType<typeof useSelfAdult>): string {
  if (!selfAdult) return template

  const cpfTotal =
    selfAdult.cpf.balances.oa +
    selfAdult.cpf.balances.sa +
    selfAdult.cpf.balances.ma +
    selfAdult.cpf.balances.ra

  const firstProperty = selfAdult._firstProperty

  return template
    .replace('{currentAge}', String(selfAdult.currentAge))
    .replace('{retirementAge}', String(selfAdult.retirementAge))
    .replace('{annualIncome}', selfAdult.annualIncome.toLocaleString())
    .replace('{annualExpenses}', selfAdult.annualExpenses.toLocaleString())
    .replace('{liquidNetWorth}', selfAdult.liquidNetWorth.toLocaleString())
    .replace('{cpfSummary}', `$${cpfTotal.toLocaleString()} total CPF`)
    .replace('{ispTier}', selfAdult.healthcare.ispTier ?? 'none')
    .replace('{allocationTemplate}', 'Balanced')
    .replace('{propertyType}', firstProperty?.propertyType ?? 'property')
    .replace(
      '{propertyValue}',
      firstProperty ? (firstProperty.existingPropertyValue ?? 0).toLocaleString() : '0'
    )
}

function useSelfAdult() {
  const plan = useHouseholdPlanStore((s) => s.plan)
  const selfAdult = plan.adults.find((a) => a.owner === 'self') ?? plan.adults[0] ?? null
  const firstProperty = plan.properties[0] ?? null

  if (!selfAdult) return null

  return {
    ...selfAdult,
    _firstProperty: firstProperty,
  }
}

export function SectionIntro({ sectionId }: SectionIntroProps) {
  const guide = getSectionGuide(sectionId)

  const setupCompleted = useUIStore((s) => s.setupCompleted)
  const setupPopulatedSections = useUIStore((s) => s.setupPopulatedSections)
  const dismissedSectionIntros = useUIStore((s) => s.dismissedSectionIntros)
  const setField = useUIStore((s) => s.setField)

  const selfAdult = useSelfAdult()

  if (!guide) return null
  if (dismissedSectionIntros.includes(sectionId)) return null

  const isContextAware = setupCompleted && setupPopulatedSections.includes(sectionId)

  const text = isContextAware
    ? fillTemplate(guide.contextTemplate, selfAdult)
    : guide.coldIntro

  function handleDismiss() {
    setField('dismissedSectionIntros', [...dismissedSectionIntros, sectionId])
  }

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-md bg-muted/50 border border-border px-4 py-3 text-sm text-muted-foreground"
    >
      <p className="flex-1">{text}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
        className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
