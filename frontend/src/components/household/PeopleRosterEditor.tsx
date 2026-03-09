import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { NumberInput } from '@/components/shared/NumberInput'
import type { HouseholdPlanType, DependentRelationship } from '@/lib/household/types'

export interface SetupDependentDraft {
  id: string
  label: string
  relationship: DependentRelationship
  currentAge: number
}

interface PeopleRosterEditorProps {
  planType: Exclude<HouseholdPlanType, 'individual'>
  selfName: string
  selfAge: number
  onSelfNameChange: (value: string) => void
  onSelfAgeChange: (value: number) => void
  partnerEnabled: boolean
  onPartnerEnabledChange: (value: boolean) => void
  partnerName: string
  partnerAge: number
  onPartnerNameChange: (value: string) => void
  onPartnerAgeChange: (value: number) => void
  dependents: SetupDependentDraft[]
  onAddDependent: () => void
  onUpdateDependent: (id: string, updates: Partial<SetupDependentDraft>) => void
  onRemoveDependent: (id: string) => void
}

export function PeopleRosterEditor({
  planType,
  selfName,
  selfAge,
  onSelfNameChange,
  onSelfAgeChange,
  partnerEnabled,
  onPartnerEnabledChange,
  partnerName,
  partnerAge,
  onPartnerNameChange,
  onPartnerAgeChange,
  dependents,
  onAddDependent,
  onUpdateDependent,
  onRemoveDependent,
}: PeopleRosterEditorProps) {
  const showPartnerToggle = planType === 'household'
  const showPartnerFields = planType === 'couple' || partnerEnabled

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="self-name">Your name</Label>
              <Input
                id="self-name"
                value={selfName}
                onChange={(event) => onSelfNameChange(event.target.value)}
                placeholder="You"
              />
            </div>
            <div className="space-y-1">
              <Label>Your age</Label>
              <NumberInput
                integer
                min={18}
                max={99}
                value={selfAge}
                onChange={onSelfAgeChange}
              />
            </div>
          </div>

          {showPartnerToggle && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="font-medium">Include a second planning adult</div>
                <div className="text-sm text-muted-foreground">
                  Add a partner now, or start with one adult and dependents only.
                </div>
              </div>
              <Switch
                checked={partnerEnabled}
                onCheckedChange={onPartnerEnabledChange}
                aria-label="Include partner"
              />
            </div>
          )}

          {showPartnerFields && (
            <div className="grid grid-cols-1 @md:grid-cols-2 gap-4 rounded-md border p-4">
              <div className="space-y-1">
                <Label htmlFor="partner-name">Partner name</Label>
                <Input
                  id="partner-name"
                  value={partnerName}
                  onChange={(event) => onPartnerNameChange(event.target.value)}
                  placeholder="Partner"
                />
              </div>
              <div className="space-y-1">
                <Label>Partner age</Label>
                <NumberInput
                  integer
                  min={18}
                  max={99}
                  value={partnerAge}
                  onChange={onPartnerAgeChange}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {planType === 'household' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Dependents</div>
                <div className="text-sm text-muted-foreground">
                  Add any children or supported family members you want to track from the start.
                </div>
              </div>
              <Button type="button" variant="outline" onClick={onAddDependent}>
                Add dependent
              </Button>
            </div>

            {dependents.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No dependents added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {dependents.map((dependent, index) => (
                  <div key={dependent.id} className="grid grid-cols-1 @lg:grid-cols-4 gap-3 rounded-md border p-4">
                    <div className="space-y-1">
                      <Label htmlFor={`dependent-name-${dependent.id}`}>Name</Label>
                      <Input
                        id={`dependent-name-${dependent.id}`}
                        value={dependent.label}
                        onChange={(event) => onUpdateDependent(dependent.id, { label: event.target.value })}
                        placeholder={`Dependent ${index + 1}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Relationship</Label>
                      <Select
                        value={dependent.relationship}
                        onValueChange={(value: DependentRelationship) => onUpdateDependent(dependent.id, { relationship: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="child">Child</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Current age</Label>
                      <NumberInput
                        integer
                        min={0}
                        max={120}
                        value={dependent.currentAge}
                        onChange={(value) => onUpdateDependent(dependent.id, { currentAge: value })}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => onRemoveDependent(dependent.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
