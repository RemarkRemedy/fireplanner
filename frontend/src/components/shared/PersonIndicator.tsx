import { Users, User } from 'lucide-react'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PersonIndicatorProps {
  className?: string
  /** If true, shows "Household" instead of person name */
  showHousehold?: boolean
}

/**
 * Interactive dropdown showing which person's data is being displayed.
 * Allows switching between persons without scrolling to the top.
 * Used in section headers to clarify context (person-specific vs household-level).
 */
export function PersonIndicator({ className, showHousehold = false }: PersonIndicatorProps) {
  const household = useHouseholdStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)
  const setUIField = useUIStore((s) => s.setField)

  if (!household.householdMode || household.persons.length === 0) {
    return null
  }

  if (showHousehold) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm font-normal text-blue-600 dark:text-blue-400', className)}>
        <Users className="h-4 w-4" />
        Household
      </span>
    )
  }

  const effectivePersonId = selectedPersonId || household.persons[0]?.profile.id
  const selectedPerson = household.persons.find((p) => p.profile.id === effectivePersonId)

  if (!selectedPerson) return null

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Select
        value={effectivePersonId}
        onValueChange={(personId) => setUIField('selectedPersonId', personId)}
      >
        <SelectTrigger className="h-7 w-auto gap-1 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900 transition-colors">
          <User className="h-3.5 w-3.5" />
          <SelectValue>
            <span className="text-xs font-medium">{selectedPerson.profile.name}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {household.persons.map((person) => (
            <SelectItem key={person.profile.id} value={person.profile.id}>
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                <span className="font-medium">{person.profile.name}</span>
                <span className="text-xs text-muted-foreground">
                  (Age {person.profile.currentAge})
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
