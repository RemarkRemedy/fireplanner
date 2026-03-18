import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calculator, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '@/lib/utils'
import { calculateBSD, calculateABSD } from '@/lib/calculations/property'
import { BSD_BRACKETS, ABSD_RATES, type ResidencyType } from '@/lib/data/stampDutyRates'

type PropertyCount = '1' | '2' | '3'

const PROPERTY_COUNT_LABELS: Record<PropertyCount, string> = {
  '1': '1st property',
  '2': '2nd property',
  '3': '3rd or subsequent',
}

/** Build the BSD bracket breakdown for display */
function getBsdBreakdown(purchasePrice: number) {
  const rows: { bracket: string; rate: string; amount: number }[] = []
  let remaining = purchasePrice

  const bracketLabels = ['First $180,000', 'Next $180,000', 'Next $640,000', 'Next $500,000', 'Next $1,500,000', 'Remainder']

  for (let i = 0; i < BSD_BRACKETS.length && remaining > 0; i++) {
    const [bracketSize, rate] = BSD_BRACKETS[i]
    const taxable = Math.min(remaining, bracketSize)
    const amount = taxable * rate
    rows.push({
      bracket: bracketLabels[i] ?? `Bracket ${i + 1}`,
      rate: `${(rate * 100).toFixed(0)}%`,
      amount,
    })
    remaining -= taxable
  }
  return rows
}

export function StampDutyCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(1_500_000)
  const [residency, setResidency] = useState<ResidencyType>('citizen')
  const [propertyCount, setPropertyCount] = useState<PropertyCount>('1')

  const results = useMemo(() => {
    if (purchasePrice <= 0) return null

    const bsd = calculateBSD(purchasePrice)
    const absd = calculateABSD(purchasePrice, residency, parseInt(propertyCount))
    const total = bsd + absd
    const effectiveRate = total / purchasePrice
    const bsdBreakdown = getBsdBreakdown(purchasePrice)
    const absdRate = ABSD_RATES[residency][Math.min(parseInt(propertyCount), ABSD_RATES[residency].length) - 1]

    return { bsd, absd, total, effectiveRate, bsdBreakdown, absdRate }
  }, [purchasePrice, residency, propertyCount])

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Stamp Duty Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <CurrencyInput
            label="Purchase Price"
            value={purchasePrice}
            onChange={setPurchasePrice}
            tooltip="The agreed purchase price or market value, whichever is higher"
          />
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Buyer Profile</Label>
            <Select value={residency} onValueChange={(v) => setResidency(v as ResidencyType)}>
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
          <div className="flex flex-col gap-1">
            <Label className="text-sm">Property Number</Label>
            <Select value={propertyCount} onValueChange={(v) => setPropertyCount(v as PropertyCount)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1st property</SelectItem>
                <SelectItem value="2">2nd property</SelectItem>
                <SelectItem value="3">3rd or subsequent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="space-y-6 pt-4 border-t">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">BSD</p>
                <p className="font-semibold">{formatCurrency(results.bsd, 0)}</p>
              </div>
              <div className={`p-3 rounded-lg ${
                results.absd > 0
                  ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                  : 'bg-muted/50'
              }`}>
                <p className="text-xs text-muted-foreground">
                  ABSD ({(results.absdRate * 100).toFixed(0)}%)
                </p>
                <p className={`font-semibold ${results.absd > 0 ? 'text-amber-700 dark:text-amber-400' : ''}`}>
                  {formatCurrency(results.absd, 0)}
                </p>
              </div>
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground">Total stamp duty</p>
                <p className="text-lg font-bold">{formatCurrency(results.total, 0)}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">Effective rate</p>
                <p className="font-semibold">{(results.effectiveRate * 100).toFixed(2)}%</p>
              </div>
            </div>

            {/* BSD Breakdown */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                BSD breakdown (progressive)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-1.5 pr-2 font-medium">Bracket</th>
                      <th className="text-right py-1.5 px-2 font-medium">Rate</th>
                      <th className="text-right py-1.5 pl-2 font-medium">Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.bsdBreakdown.map((row) => (
                      <tr key={row.bracket} className="border-b last:border-b-0">
                        <td className="py-1.5 pr-2">{row.bracket}</td>
                        <td className="py-1.5 px-2 text-right tabular-nums">{row.rate}</td>
                        <td className="py-1.5 pl-2 text-right tabular-nums">{formatCurrency(row.amount, 0)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 font-semibold">
                      <td className="py-1.5 pr-2">Total BSD</td>
                      <td className="py-1.5 px-2"></td>
                      <td className="py-1.5 pl-2 text-right tabular-nums">{formatCurrency(results.bsd, 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* ABSD note */}
            {results.absd > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                <p>
                  <span className="font-medium">ABSD of {(results.absdRate * 100).toFixed(0)}%</span> applies because you are
                  {residency === 'pr' ? ' a Permanent Resident' : residency === 'foreigner' ? ' a foreigner' : ' a citizen'}
                  {' '}buying your {PROPERTY_COUNT_LABELS[propertyCount]}.
                  {residency === 'citizen' && propertyCount === '2' && (
                    ' Citizens pay 20% ABSD on their second residential property.'
                  )}
                  {residency === 'pr' && propertyCount === '1' && (
                    ' PRs pay 5% ABSD even on their first property.'
                  )}
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="flex gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Rates effective from 27 April 2023. This does not account for remissions
                (e.g., married couples, HDB upgraders). Check{' '}
                <a
                  href="https://www.iras.gov.sg/taxes/stamp-duty/for-property/buying-or-acquiring-property/additional-buyer's-stamp-duty-(absd)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  IRAS
                </a>
                {' '}for the latest rates and remission eligibility. To see how stamp duty affects your
                retirement plan, use the{' '}
                <Link to="/inputs#section-property" className="text-primary hover:underline">full property planner</Link>.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
