import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { useProfileStore } from '@/stores/useProfileStore'
import { MAX_LIFE_EVENTS } from '@/hooks/useDisruptionImpact'
import type { LifeEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

// Expense-focused quick-add templates
interface ExpenseTemplate {
  label: string
  event: Omit<LifeEvent, 'id'>
}

function makeExpenseTemplates(currentAge: number, lifeExpectancy: number): ExpenseTemplate[] {
  const clamp = (offset: number, duration: number) => {
    const start = Math.min(lifeExpectancy - 1, Math.max(currentAge + 1, currentAge + offset))
    const end = Math.min(lifeExpectancy, start + duration)
    return { startAge: start, endAge: end }
  }

  return [
    {
      label: 'Medical Emergency',
      event: {
        ...clamp(10, 2),
        name: 'Medical Emergency',
        incomeImpact: 1,
        affectedStreamIds: [],
        savingsPause: false,
        cpfPause: false,
        additionalAnnualExpense: 30000,
        lumpSumCost: 10000,
      },
    },
    {
      label: 'Dependent Care (5yr)',
      event: {
        ...clamp(15, 5),
        name: 'Dependent Care',
        incomeImpact: 1,
        affectedStreamIds: [],
        savingsPause: false,
        cpfPause: false,
        additionalAnnualExpense: 24000,
      },
    },
    {
      label: 'Lifestyle Downgrade',
      event: {
        ...clamp(5, 20),
        name: 'Lifestyle Downgrade',
        incomeImpact: 1,
        affectedStreamIds: [],
        savingsPause: false,
        cpfPause: false,
        expenseReductionPercent: 0.20,
      },
    },
  ]
}

export function ExpenseLifeEventsSection() {
  const income = useIncomeStore()
  const currentAge = useProfileStore((s) => s.currentAge)
  const lifeExpectancy = useProfileStore((s) => s.lifeExpectancy)
  const errors = income.validationErrors

  const templates = makeExpenseTemplates(currentAge, lifeExpectancy)
  const atLimit = income.lifeEvents.length >= MAX_LIFE_EVENTS

  const addCustomEvent = () => {
    if (atLimit) return
    const id = `event-${crypto.randomUUID()}`
    income.addLifeEvent({
      id,
      name: 'Custom Event',
      startAge: Math.min(lifeExpectancy - 1, currentAge + 5),
      endAge: Math.min(lifeExpectancy, currentAge + 7),
      incomeImpact: 1,
      affectedStreamIds: [],
      savingsPause: false,
      cpfPause: false,
    })
  }

  const applyTemplate = (template: ExpenseTemplate) => {
    if (atLimit) return
    const id = `event-${crypto.randomUUID()}`
    income.addLifeEvent({ ...template.event, id })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            Life Events (Expense Impact)
            <InfoTooltip text="Model expense shocks like medical emergencies, dependent care costs, or lifestyle changes. Same events as Income section — edit expense fields here." />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Checkbox
              id="expense-life-events-enabled"
              checked={income.lifeEventsEnabled}
              onCheckedChange={(checked: boolean | 'indeterminate') => income.setField('lifeEventsEnabled', checked === true)}
            />
            <Label htmlFor="expense-life-events-enabled" className="text-sm cursor-pointer">Enable</Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!income.lifeEventsEnabled ? (
          <p className="text-sm text-muted-foreground">
            Life events are disabled. Enable them to model expense shocks and lifestyle changes.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Same events as Income section — edit expense fields here.
            </p>

            {/* Quick-add templates */}
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-sm text-muted-foreground">Quick add:</Label>
              {templates.map((tmpl) => (
                <Button
                  key={tmpl.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyTemplate(tmpl)}
                  disabled={atLimit}
                >
                  {tmpl.label}
                </Button>
              ))}
            </div>

            {/* Event rows */}
            {income.lifeEvents.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">No life events configured.</p>
                <Button variant="outline" size="sm" onClick={addCustomEvent}>
                  Add Custom Event
                </Button>
              </div>
            ) : (
              <>
                {income.lifeEvents.map((event) => (
                  <ExpenseEventRow
                    key={event.id}
                    event={event}
                    errors={errors}
                    onUpdate={(updates) => income.updateLifeEvent(event.id, updates)}
                    onRemove={() => income.removeLifeEvent(event.id)}
                  />
                ))}
                {!atLimit && (
                  <Button variant="outline" size="sm" onClick={addCustomEvent}>
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

function ExpenseEventRow({
  event, errors, onUpdate, onRemove,
}: {
  event: LifeEvent
  errors: Record<string, string>
  onUpdate: (updates: Partial<LifeEvent>) => void
  onRemove: () => void
}) {
  const prefix = `lifeEvent_${event.id}`

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

        <CurrencyInput
          label="Additional Annual Expense"
          value={event.additionalAnnualExpense ?? 0}
          onChange={(v) => onUpdate({ additionalAnnualExpense: v || undefined })}
          tooltip="Extra yearly cost during this event (medical, care, etc.)"
        />

        <CurrencyInput
          label="Lump Sum Cost"
          value={event.lumpSumCost ?? 0}
          onChange={(v) => onUpdate({ lumpSumCost: v || undefined })}
          tooltip="One-time cost at the start of this event"
        />
      </div>

      <div className="max-w-xs">
        <PercentInput
          label="Expense Reduction"
          value={event.expenseReductionPercent ?? 0}
          onChange={(v) => onUpdate({ expenseReductionPercent: v || undefined })}
          tooltip="Lifestyle reduction during this event (e.g. 15% = spending drops by 15%)"
          step={5}
        />
      </div>
    </div>
  )
}
