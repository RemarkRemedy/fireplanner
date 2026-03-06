import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { cn } from '@/lib/utils'
import type { IncomeStream, IncomeStreamType, GrowthModel, TaxTreatment } from '@/lib/types'

const MAX_STREAMS = 5

function createStream(id: string): IncomeStream {
  return {
    id,
    name: '',
    annualAmount: 0,
    startAge: 30,
    endAge: 65,
    growthRate: 0.02,
    type: 'rental',
    growthModel: 'fixed',
    taxTreatment: 'taxable',
    isCpfApplicable: false,
    isActive: true,
  }
}

export function IncomeStreamsSection() {
  const income = useIncomeStore()
  const errors = income.validationErrors

  const addStream = () => {
    if (income.incomeStreams.length >= MAX_STREAMS) return
    const id = `stream-${crypto.randomUUID()}`
    income.addIncomeStream(createStream(id))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            Income Streams
            <InfoTooltip text="Additional income beyond your primary salary" />
          </CardTitle>
          {income.incomeStreams.length < MAX_STREAMS && (
            <Button variant="outline" size="sm" onClick={addStream}>
              Add Stream
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {income.incomeStreams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No additional income streams. Click "Add Stream" to add rental income, investments, etc.
          </p>
        ) : (
          <div className="space-y-4">
            {income.incomeStreams.map((stream) => (
              <StreamRow
                key={stream.id}
                stream={stream}
                errors={errors}
                onUpdate={(updates) => income.updateIncomeStream(stream.id, updates)}
                onRemove={() => income.removeIncomeStream(stream.id)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StreamRow({
  stream, errors, onUpdate, onRemove,
}: {
  stream: IncomeStream
  errors: Record<string, string>
  onUpdate: (updates: Partial<IncomeStream>) => void
  onRemove: () => void
}) {
  const prefix = `incomeStream_${stream.id}`

  return (
    <div className={cn(
      'p-3 border rounded-md space-y-3',
      !stream.isActive && 'opacity-50'
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input
            value={stream.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Stream name"
            className="w-full md:w-48 border-blue-300"
          />
          <div className="flex items-center gap-1.5">
            <Checkbox
              id={`stream-active-${stream.id}`}
              checked={stream.isActive}
              onCheckedChange={(checked: boolean | 'indeterminate') => onUpdate({ isActive: checked === true })}
            />
            <Label htmlFor={`stream-active-${stream.id}`} className="text-sm cursor-pointer">Active</Label>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={stream.type}
            onValueChange={(v) => {
              const update: Partial<IncomeStream> = { type: v as IncomeStreamType }
              if (v !== 'employment') update.isCpfApplicable = false
              onUpdate(update)
            }}
          >
            <SelectTrigger className="h-9 border-blue-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="employment">Employment</SelectItem>
              <SelectItem value="rental">Rental</SelectItem>
              <SelectItem value="investment">Investment</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="government">Government</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CurrencyInput
          label="Annual Amount"
          value={stream.annualAmount}
          onChange={(v) => onUpdate({ annualAmount: v })}
          error={errors[`${prefix}_annualAmount`]}
        />

        <div className="space-y-1">
          <Label className="text-xs">Growth Model</Label>
          <Select
            value={stream.growthModel}
            onValueChange={(v) => onUpdate({ growthModel: v as GrowthModel })}
          >
            <SelectTrigger className="h-9 border-blue-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">Fixed Rate</SelectItem>
              <SelectItem value="inflation-linked">Inflation-Linked</SelectItem>
              <SelectItem value="none">No Growth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <PercentInput
          label="Growth Rate"
          value={stream.growthRate}
          onChange={(v) => onUpdate({ growthRate: v })}
          disabled={stream.growthModel !== 'fixed'}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Start Age</Label>
          <Input
            type="number"
            inputMode="numeric"
            value={stream.startAge}
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
            value={stream.endAge}
            onChange={(e) => onUpdate({ endAge: parseInt(e.target.value) || 0 })}
            className={cn('border-blue-300', errors[`${prefix}_endAge`] && 'border-destructive')}
          />
          {errors[`${prefix}_endAge`] && (
            <p className="text-xs text-destructive">{errors[`${prefix}_endAge`]}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Tax Treatment</Label>
          <Select
            value={stream.taxTreatment}
            onValueChange={(v) => onUpdate({ taxTreatment: v as TaxTreatment })}
          >
            <SelectTrigger className="h-9 border-blue-300">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="taxable">Taxable</SelectItem>
              <SelectItem value="tax-exempt">Tax-Exempt</SelectItem>
              <SelectItem value="cpf">Central Provident Fund (CPF)</SelectItem>
              <SelectItem value="srs">Supplementary Retirement Scheme (SRS)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {stream.type === 'employment' && (
          <div className="flex items-end pb-1">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id={`stream-cpf-${stream.id}`}
                checked={stream.isCpfApplicable}
                onCheckedChange={(checked: boolean | 'indeterminate') => onUpdate({ isCpfApplicable: checked === true })}
              />
              <Label htmlFor={`stream-cpf-${stream.id}`} className="text-sm cursor-pointer">CPF Applicable</Label>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
