import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { usePropertyStore } from '@/stores/usePropertyStore'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { PropertyType } from '@/lib/types'

export function PropertyInputForm() {
  const store = usePropertyStore()
  const errors = store.validationErrors

  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>
              Property Type
              <InfoTooltip text="Housing & Development Board (HDB), Condo, or Landed. Affects Additional Buyer's Stamp Duty (ABSD) and Loan-to-Value calculations." />
            </Label>
            <Select
              value={store.propertyType}
              onValueChange={(v) => store.setField('propertyType', v as PropertyType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hdb">HDB</SelectItem>
                <SelectItem value="condo">Condo</SelectItem>
                <SelectItem value="landed">Landed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <CurrencyInput
            label="Purchase Price"
            value={store.purchasePrice}
            onChange={(v) => store.setField('purchasePrice', v)}
            error={errors.purchasePrice}
          />

          <div className="space-y-2">
            <Label>
              Lease (years)
              <InfoTooltip text="99-year leasehold is standard for condos. 999 or freehold for some landed. Leasehold decay follows the leasehold depreciation schedule (Bala's Table)." source="SLA" sourceUrl="https://isomer-user-content.by.gov.sg/50/ade6cd16-890b-4a1b-9d1d-d0e189daba03/balas-table.pdf" />
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              value={store.leaseYears}
              onChange={(e) => store.setField('leaseYears', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Appreciation Rate</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                step={0.5}
                className="pr-7"
                value={(store.appreciationRate * 100).toFixed(1)}
                onChange={(e) => store.setField('appreciationRate', Number(e.target.value) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rental Yield</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                step={0.5}
                className="pr-7"
                value={(store.rentalYield * 100).toFixed(1)}
                onChange={(e) => store.setField('rentalYield', Number(e.target.value) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mortgage Rate</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                step={0.1}
                className="pr-7"
                value={(store.mortgageRate * 100).toFixed(1)}
                onChange={(e) => store.setField('mortgageRate', Number(e.target.value) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            {errors.mortgageRate && <p className="text-xs text-destructive">{errors.mortgageRate}</p>}
          </div>

          <div className="space-y-2">
            <Label>Mortgage Term (years)</Label>
            <Input
              type="number"
              inputMode="numeric"
              value={store.mortgageTerm}
              onChange={(e) => store.setField('mortgageTerm', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Loan-to-Value (LTV)</Label>
            <div className="relative">
              <Input
                type="number"
                inputMode="decimal"
                className="pr-7"
                value={(store.ltv * 100).toFixed(0)}
                onChange={(e) => store.setField('ltv', Number(e.target.value) / 100)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Residency (for Additional Buyer's Stamp Duty)</Label>
            <Select
              value={store.residencyForAbsd}
              onValueChange={(v) => store.setField('residencyForAbsd', v as 'citizen' | 'pr' | 'foreigner')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="citizen">Singapore Citizen</SelectItem>
                <SelectItem value="pr">Permanent Resident</SelectItem>
                <SelectItem value="foreigner">Foreigner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              Existing Properties
              <InfoTooltip text="Number of properties already owned. Affects Additional Buyer's Stamp Duty (ABSD) rate." source="IRAS" sourceUrl="https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/additional-buyer's-stamp-duty-(absd)" />
            </Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={10}
              value={store.propertyCount}
              onChange={(e) => store.setField('propertyCount', Number(e.target.value))}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
