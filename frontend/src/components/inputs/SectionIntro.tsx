import { X } from 'lucide-react'
import { getSectionGuide } from '@/lib/data/fieldGuide'
import type { SectionId } from '@/lib/household/sectionOrder'
import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { useUIStore } from '@/stores/useUIStore'
import { useAllocationStore } from '@/stores/useAllocationStore'

interface SectionIntroProps {
  sectionId: SectionId
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fillTemplate(template: string, selfAdult: ReturnType<typeof useSelfAdult>, allocationTemplate: string): string {
  if (!selfAdult) return template

  const cpfTotal =
    selfAdult.cpf.balances.oa +
    selfAdult.cpf.balances.sa +
    selfAdult.cpf.balances.ma +
    selfAdult.cpf.balances.ra

  const firstProperty = selfAdult._firstProperty

  return template
    .replaceAll('{currentAge}', String(selfAdult.currentAge))
    .replaceAll('{retirementAge}', String(selfAdult.retirementAge))
    .replaceAll('{annualIncome}', selfAdult.annualIncome.toLocaleString())
    .replaceAll('{annualExpenses}', selfAdult.annualExpenses.toLocaleString())
    .replaceAll('{liquidNetWorth}', selfAdult.liquidNetWorth.toLocaleString())
    .replaceAll('{cpfSummary}', `$${cpfTotal.toLocaleString()} total CPF`)
    .replaceAll('{ispTier}', selfAdult.healthcare.ispTier ?? 'none')
    .replaceAll('{allocationTemplate}', capitalize(allocationTemplate))
    .replaceAll('{propertyType}', firstProperty?.propertyType ?? 'property')
    .replaceAll(
      '{propertyValue}',
      firstProperty ? (firstProperty.existingPropertyValue ?? 0).toLocaleString() : '0'
    )
}

function useSelfAdult() {
  const selfAdult = useHouseholdPlanStore((s) => s.plan.adults.find((a) => a.owner === 'self') ?? s.plan.adults[0] ?? null)
  const firstProperty = useHouseholdPlanStore((s) => s.plan.properties[0] ?? null)

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
  const selectedTemplate = useAllocationStore((s) => s.selectedTemplate) ?? 'balanced'

  if (!guide) return null
  if (dismissedSectionIntros.includes(sectionId)) return null

  const isContextAware = setupCompleted && setupPopulatedSections.includes(sectionId)

  const text = isContextAware
    ? fillTemplate(guide.contextTemplate, selfAdult, selectedTemplate)
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
