import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, User, X } from 'lucide-react'
import { useHouseholdStore, createDefaultPerson } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

export function PersonSelector() {
  const household = useHouseholdStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)
  const setUIField = useUIStore((s) => s.setField)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')

  // Auto-select first person if none selected
  const effectivePersonId = selectedPersonId || household.persons[0]?.profile.id

  const handleAddPerson = () => {
    const id = `person-${Date.now()}`
    const name = newPersonName.trim() || `Person ${household.persons.length + 1}`
    const person = createDefaultPerson(id, name)
    household.addPerson(person)
    setUIField('selectedPersonId', id)
    setNewPersonName('')
    setShowAddDialog(false)
  }

  const handleRemovePerson = (personId: string) => {
    if (household.persons.length <= 1) {
      toast.error('Cannot remove the last person. Switch to single-person mode instead.')
      return
    }
    household.removePerson(personId)
    // Select first remaining person
    const remaining = household.persons.filter((p) => p.profile.id !== personId)
    if (remaining.length > 0) {
      setUIField('selectedPersonId', remaining[0].profile.id)
    }
  }

  if (!household.householdMode) {
    return null
  }

  return (
    <>
      <Card className="p-3 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-2">
          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Household Members</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {household.persons.map((person) => {
            const isSelected = person.profile.id === effectivePersonId
            return (
              <div
                key={person.profile.id}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-md border transition-all cursor-pointer group',
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-background hover:bg-muted border-border'
                )}
                onClick={() => setUIField('selectedPersonId', person.profile.id)}
              >
                <span className="text-sm font-medium">{person.profile.name}</span>
                <span className="text-xs opacity-70">({person.profile.currentAge})</span>
                {household.persons.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePerson(person.profile.id)
                    }}
                    className={cn(
                      'ml-1 opacity-0 group-hover:opacity-100 transition-opacity',
                      isSelected && 'opacity-100'
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddDialog(true)}
            className="h-auto py-1.5"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Person
          </Button>
        </div>
        {household.persons.length > 0 && effectivePersonId && (
          <p className="text-xs text-muted-foreground mt-2">
            Viewing income and CPF for: <strong>{household.persons.find((p) => p.profile.id === effectivePersonId)?.profile.name}</strong>
          </p>
        )}
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Household Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="e.g., Spouse, Partner, Person 2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddPerson()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPerson}>Add Person</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
