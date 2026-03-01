import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { cn } from '@/lib/utils'
import type { LifeEvent } from '@/lib/types'
import { MAX_LIFE_EVENTS } from '@/hooks/useDisruptionImpact'
import { trackEvent } from '@/lib/analytics'

function createEvent(id: string): LifeEvent {
  return {
    id,
    name: '',
    startAge: 35,
    endAge: 36,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  }
}

const EVENT_TEMPLATES: Record<string, Omit<LifeEvent, 'id'>> = {
  'Career Break at 35': {
    name: 'Career Break',
    startAge: 35,
    endAge: 36,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  },
  'Part-time 40-45': {
    name: 'Part-time Work',
    startAge: 40,
    endAge: 45,
    incomeImpact: 0.5,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  },
  'Retrenchment at 50': {
    name: 'Retrenchment',
    startAge: 50,
    endAge: 51,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  },
  'Childcare Leave': {
    name: 'Childcare Leave',
    startAge: 32,
    endAge: 34,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  },
  'Job Loss (6 months)': {
    name: 'Job Loss (6 months)',
    startAge: 35,
    endAge: 36,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  },
  'Job Loss (12 months)': {
    name: 'Job Loss (12 months)',
    startAge: 35,
    endAge: 37,
    incomeImpact: 0,
    affectedStreamIds: [],
    savingsPause: true,
    cpfPause: true,
  },
  'Partial Disability (3yr)': {
    name: 'Partial Disability',
    startAge: 40,
    endAge: 43,
    incomeImpact: 0.5,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  },
  'Parent Care (5yr)': {
    name: 'Parent Care',
    startAge: 45,
    endAge: 50,
    incomeImpact: 0.8,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  },
  'Recession Pay Cut (2yr)': {
    name: 'Recession Pay Cut',
    startAge: 38,
    endAge: 40,
    incomeImpact: 0.8,
    affectedStreamIds: [],
    savingsPause: false,
    cpfPause: false,
  },
}

export function LifeEventsSection() {
  const income = useIncomeStore()
  const errors = income.validationErrors

  const addEvent = () => {
    if (income.lifeEvents.length >= MAX_LIFE_EVENTS) return
    const id = `event-${crypto.randomUUID()}`
    income.addLifeEvent(createEvent(id))
    trackEvent('life_event_added', { source: 'custom' })
  }

  const applyTemplate = (templateName: string) => {
    const template = EVENT_TEMPLATES[templateName]
    if (!template) return
    if (income.lifeEvents.length >= MAX_LIFE_EVENTS) return
    const id = `event-${crypto.randomUUID()}`
    income.addLifeEvent({ ...template, id })
    trackEvent('life_event_added', { source: 'template', template_name: templateName })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            Life Events
            <InfoTooltip text="Career breaks, part-time periods, or other income disruptions" />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              id="life-events-enabled"
              checked={income.lifeEventsEnabled}
              onCheckedChange={(checked: boolean | 'indeterminate') => { income.setField('lifeEventsEnabled', checked === true); trackEvent('feature_toggle', { feature: 'life_events', enabled: checked === true }) }}
            />
            <Label htmlFor="life-events-enabled" className="text-sm cursor-pointer">Enable</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!income.lifeEventsEnabled ? (
          <p className="text-sm text-muted-foreground">
            Life events are disabled. Enable them to model career breaks, part-time work, etc.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm text-muted-foreground">Templates:</Label>
              {Object.keys(EVENT_TEMPLATES).map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(name)}
                  disabled={income.lifeEvents.length >= MAX_LIFE_EVENTS}
                >
                  {name}
                </Button>
              ))}
            </div>

            {income.lifeEvents.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No life events configured.</p>
                <Button variant="outline" size="sm" onClick={addEvent}>
                  Add Custom Event
                </Button>
              </div>
            ) : (
              <>
                {income.lifeEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    errors={errors}
                    streamNames={income.incomeStreams.map((s) => ({ id: s.id, name: s.name || 'Unnamed' }))}
                    onUpdate={(updates) => income.updateLifeEvent(event.id, updates)}
                    onRemove={() => { income.removeLifeEvent(event.id); trackEvent('life_event_removed') }}
                  />
                ))}
                {income.lifeEvents.length < MAX_LIFE_EVENTS && (
                  <Button variant="outline" size="sm" onClick={addEvent}>
                    Add Event
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EventRow({
  event, errors, streamNames, onUpdate, onRemove,
}: {
  event: LifeEvent
  errors: Record<string, string>
  streamNames: { id: string; name: string }[]
  onUpdate: (updates: Partial<LifeEvent>) => void
  onRemove: () => void
}) {
  const prefix = `lifeEvent_${event.id}`

  const toggleStream = (streamId: string) => {
    const current = event.affectedStreamIds
    const updated = current.includes(streamId)
      ? current.filter((id) => id !== streamId)
      : [...current, streamId]
    onUpdate({ affectedStreamIds: updated })
  }

  return (
    <div className="p-3 border rounded-md space-y-3">
      <div className="flex items-center justify-between">
        <Input
          value={event.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Event name"
          className="w-full md:w-48 border-blue-300"
        />
        <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Start Age</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={event.startAge}
            onChange={(e) => onUpdate({ startAge: parseInt(e.target.value) || 0 })}
            className={cn('border-blue-300', errors[`${prefix}_startAge`] && 'border-destructive')}
          />
          {errors[`${prefix}_startAge`] && (
            <p className="text-xs text-destructive">{errors[`${prefix}_startAge`]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">End Age</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={event.endAge}
            onChange={(e) => onUpdate({ endAge: parseInt(e.target.value) || 0 })}
            className={cn('border-blue-300', errors[`${prefix}_endAge`] && 'border-destructive')}
          />
          {errors[`${prefix}_endAge`] && (
            <p className="text-xs text-destructive">{errors[`${prefix}_endAge`]}</p>
          )}
        </div>

        <PercentInput
          label="Income Impact"
          value={event.incomeImpact}
          onChange={(v) => onUpdate({ incomeImpact: v })}
          error={errors[`${prefix}_incomeImpact`]}
          tooltip="0% = no income, 50% = half income, 100% = full income"
          step={5}
        />

        <div className="flex flex-col gap-1.5 justify-end">
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`${prefix}-pause-savings`}
              checked={event.savingsPause}
              onCheckedChange={(checked: boolean | 'indeterminate') => onUpdate({ savingsPause: checked === true })}
            />
            <Label htmlFor={`${prefix}-pause-savings`} className="text-sm cursor-pointer">Pause Savings</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`${prefix}-pause-cpf`}
              checked={event.cpfPause}
              onCheckedChange={(checked: boolean | 'indeterminate') => onUpdate({ cpfPause: checked === true })}
            />
            <Label htmlFor={`${prefix}-pause-cpf`} className="text-sm cursor-pointer">Pause CPF</Label>
          </div>
        </div>
      </div>

      {streamNames.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            Affected Streams (empty = all)
          </Label>
          <div className="flex gap-2 flex-wrap">
            {streamNames.map(({ id, name }) => (
              <div key={id} className="flex items-center gap-1.5">
                <Checkbox
                  id={`${prefix}-stream-${id}`}
                  checked={event.affectedStreamIds.includes(id)}
                  onCheckedChange={() => toggleStream(id)}
                />
                <Label htmlFor={`${prefix}-stream-${id}`} className="text-sm cursor-pointer">{name}</Label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
