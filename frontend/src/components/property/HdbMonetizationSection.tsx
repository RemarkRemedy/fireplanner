import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { AlertTriangle } from 'lucide-react'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { useIncomeStore } from '@/stores/useIncomeStore'
import { computeHdbSublettingIncome, computeLbsProceeds } from '@/lib/calculations/hdb'
import { SUBLETTING_RATE_SUGGESTIONS, LBS_RETAINED_LEASE_OPTIONS } from '@/lib/data/hdbRates'
import { formatCurrency } from '@/lib/utils'
import { useProfileStore } from '@/stores/useProfileStore'
import type { HdbFlatType, HdbMonetizationStrategy } from '@/lib/types'

export function HdbMonetizationSection() {
  const store = usePropertyStore()

  const strategy = store.hdbMonetizationStrategy
  const flatType = store.hdbFlatType
  const suggestion = SUBLETTING_RATE_SUGGESTIONS[flatType]
  const hasRentalStream = useIncomeStore(s =>
    s.incomeStreams.some(stream => stream.type === 'rental' && stream.isActive)
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Housing & Development Board (HDB) Monetization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-sm flex items-center gap-1">
              Flat Type
              <InfoTooltip text="Your HDB flat type. Used to suggest typical subletting rates." />
            </Label>
            <Select
              value={flatType}
              onValueChange={(v) => store.setField('hdbFlatType', v as HdbFlatType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2-room">2-Room</SelectItem>
                <SelectItem value="3-room">3-Room</SelectItem>
                <SelectItem value="4-room">4-Room</SelectItem>
                <SelectItem value="5-room">5-Room</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-sm flex items-center gap-1">
              Monetization Strategy
              <InfoTooltip text="How you plan to monetize your HDB in retirement. None = keep as-is." />
            </Label>
            <Select
              value={strategy}
              onValueChange={(v) => store.setField('hdbMonetizationStrategy', v as HdbMonetizationStrategy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="sublet">Sublet Room(s)</SelectItem>
                <SelectItem value="lbs">Lease Buyback Scheme</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {strategy === 'sublet' && (
          <SubletInputs
            rooms={store.hdbSublettingRooms}
            rate={store.hdbSublettingRate}
            suggestion={suggestion}
            onRoomsChange={(v) => store.setField('hdbSublettingRooms', v)}
            onRateChange={(v) => store.setField('hdbSublettingRate', v)}
          />
        )}

        {strategy === 'sublet' && hasRentalStream && (
          <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You have both HDB subletting and a rental income stream active. Both contribute
              to your portfolio independently. If they refer to the same property, this
              double-counts that rental income.
            </p>
          </div>
        )}

        {strategy === 'lbs' && (
          <LbsInputs />
        )}
      </CardContent>
    </Card>
  )
}

function SubletInputs({
  rooms,
  rate,
  suggestion,
  onRoomsChange,
  onRateChange,
}: {
  rooms: number
  rate: number
  suggestion: { low: number; high: number }
  onRoomsChange: (v: number) => void
  onRateChange: (v: number) => void
}) {
  const income = computeHdbSublettingIncome({ rooms, monthlyRate: rate })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NumberInput
          label="Rooms to Sublet"
          value={rooms}
          onChange={onRoomsChange}
          integer
          min={1}
          max={3}
          tooltip="Number of rooms to rent out (maximum 3 for HDB)"
        />
        <CurrencyInput
          label="Monthly Rate per Room"
          value={rate}
          onChange={onRateChange}
          tooltip={`Indicative range for your flat type: $${suggestion.low}–$${suggestion.high}/room/month`}
        />
      </div>
      <div className="p-2 bg-muted/50 rounded text-sm">
        <span className="text-muted-foreground">Estimated Annual Income: </span>
        <span className="font-semibold">{formatCurrency(income.annualGross)}</span>
        <span className="text-muted-foreground"> (fully taxable)</span>
      </div>
    </div>
  )
}

function LbsInputs() {
  const property = usePropertyStore()
  const profile = useProfileStore()

  const lbsResult = computeLbsProceeds({
    flatValue: property.existingPropertyValue,
    remainingLease: property.leaseYears,
    retainedLease: property.hdbLbsRetainedLease,
    cpfRaBalance: profile.cpfRA,
    retirementSum: 213000, // Current FRS approximation
  })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-sm flex items-center gap-1">
            Retained Lease
            <InfoTooltip text="Years of lease to keep. HDB Lease Buyback Scheme allows 20, 25, 30, or 35 years. Must cover you to at least age 95." />
          </Label>
          <Select
            value={String(property.hdbLbsRetainedLease)}
            onValueChange={(v) => property.setField('hdbLbsRetainedLease', Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LBS_RETAINED_LEASE_OPTIONS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} years
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CurrencyInput
          label="Estimated Flat Value"
          value={property.existingPropertyValue}
          onChange={(v) => property.setField('existingPropertyValue', v)}
          tooltip="Market value of your HDB flat. Used to estimate LBS proceeds."
        />
      </div>

      <div className="p-3 rounded-lg bg-muted/30 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total LBS Proceeds</span>
          <span className="font-semibold">{formatCurrency(lbsResult.totalProceeds)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CPF Retirement Account (RA) Top-up</span>
          <span className="font-medium">{formatCurrency(lbsResult.cpfRaTopUp)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Cash Proceeds</span>
          <span className="font-medium">{formatCurrency(lbsResult.cashProceeds)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Estimated Monthly CPF LIFE Boost</span>
          <span className="font-medium">{formatCurrency(lbsResult.estimatedMonthlyLifeBoost)}/mo</span>
        </div>
      </div>
    </div>
  )
}
