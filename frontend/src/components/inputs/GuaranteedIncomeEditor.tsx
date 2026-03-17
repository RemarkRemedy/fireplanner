import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { createId } from '@/lib/household/ids'
import { ensureAgeRangeTiming, ownerLabel } from '@/lib/household/editorUtils'
import type {
  AdultOwner,
  EntryOwner,
  IncomeSource,
  PlanningAdult,
} from '@/lib/household/types'
import type { GrowthModel } from '@/lib/types'

const GUARANTEED_STREAM_TYPE_OPTIONS = [
  { value: 'investment', label: 'Annuity / Endowment' },
  { value: 'rental', label: 'Rental income' },
  { value: 'government', label: 'Pension' },
  { value: 'business', label: 'Other guaranteed' },
] as const

interface GuaranteedIncomeEditorProps {
  streams: IncomeSource[]
  selectedAdult: PlanningAdult
  adults: PlanningAdult[]
  visibleOwnerOptions: EntryOwner[]
  onAdd: (stream: IncomeSource) => void
  onUpdate: (id: string, updates: Partial<IncomeSource>) => void
  onRemove: (id: string) => void
}

function createGuaranteedStream(owner: AdultOwner, _currentAge: number): IncomeSource {
  return {
    id: createId('guaranteed-income'),
    owner,
    label: 'Private annuity',
    kind: 'income-stream',
    timing: {
      kind: 'age-range',
      owner,
      startAge: 65,
      endAge: null,
    },
    annualAmount: 12_000,
    growthRate: 0,
    growthModel: 'none',
    taxTreatment: 'tax-exempt',
    isCpfApplicable: false,
    isActive: true,
    streamType: 'investment',
    guaranteed: true,
  }
}

export function GuaranteedIncomeEditor({
  streams,
  selectedAdult,
  adults,
  visibleOwnerOptions,
  onAdd,
  onUpdate,
  onRemove,
}: GuaranteedIncomeEditorProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Guaranteed Income
            <InfoTooltip text="Income you will receive regardless of market conditions: private annuities, endowment payouts, pensions, or guaranteed rental income. CPF LIFE is handled separately and should not be added here." />
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            onClick={() => onAdd(createGuaranteedStream(selectedAdult.owner, selectedAdult.currentAge))}
          >
            Add guaranteed income
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {streams.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No guaranteed income sources yet. Add annuities, endowment payouts, pensions, or other guaranteed income to reduce your portfolio withdrawal needs.
          </div>
        ) : (
          streams.map((stream) => {
            const timing = ensureAgeRangeTiming(
              stream.timing,
              selectedAdult.owner,
              selectedAdult.currentAge,
            )

            return (
              <div key={stream.id} className="rounded-lg border p-4 space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={stream.label}
                        onChange={(event) => onUpdate(stream.id, { label: event.target.value })}
                        className="max-w-xs"
                      />
                      <Badge variant="secondary">{stream.owner === 'shared' ? 'Shared' : ownerLabel(stream.owner, adults)}</Badge>
                      <Badge variant="outline" className="text-green-600 border-green-600">Guaranteed</Badge>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => onRemove(stream.id)}>
                    Remove
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 items-end">
                  {visibleOwnerOptions.length > 1 && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Owner</Label>
                      <Select
                        value={stream.owner}
                        onValueChange={(value) => onUpdate(stream.id, {
                          owner: value as EntryOwner,
                          timing: { ...timing, owner: (value === 'shared' ? selectedAdult.owner : value) as AdultOwner },
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {visibleOwnerOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt === 'shared' ? 'Shared' : ownerLabel(opt, adults)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-sm">Type</Label>
                    <Select
                      value={stream.streamType}
                      onValueChange={(value) => onUpdate(stream.id, { streamType: value as IncomeSource['streamType'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GUARANTEED_STREAM_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <CurrencyInput
                    label="Annual payout"
                    value={stream.annualAmount}
                    onChange={(value) => onUpdate(stream.id, { annualAmount: value })}
                  />

                  <NumberInput
                    label="Starts at age"
                    integer
                    min={selectedAdult.currentAge}
                    max={selectedAdult.lifeExpectancy}
                    value={timing.startAge}
                    onChange={(value) => onUpdate(stream.id, {
                      timing: { ...timing, startAge: value },
                    })}
                  />

                  <NumberInput
                    label="Ends at age"
                    integer
                    min={timing.startAge}
                    max={selectedAdult.lifeExpectancy}
                    value={timing.endAge ?? selectedAdult.lifeExpectancy}
                    onChange={(value) => onUpdate(stream.id, {
                      timing: { ...timing, endAge: value >= selectedAdult.lifeExpectancy ? null : value },
                    })}
                    helperText={timing.endAge === null ? 'Lifetime (no end)' : undefined}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-sm">Growth</Label>
                    <Select
                      value={stream.growthModel}
                      onValueChange={(value) => onUpdate(stream.id, { growthModel: value as GrowthModel })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Flat (no growth)</SelectItem>
                        <SelectItem value="fixed">Fixed rate</SelectItem>
                        <SelectItem value="inflation-linked">Inflation-linked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {stream.growthModel === 'fixed' && (
                    <PercentInput
                      label="Growth rate"
                      value={stream.growthRate}
                      onChange={(value) => onUpdate(stream.id, { growthRate: value })}
                    />
                  )}
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
