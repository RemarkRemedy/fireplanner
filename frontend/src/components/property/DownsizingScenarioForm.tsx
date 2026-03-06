import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { usePropertyStore } from '@/stores/usePropertyStore'
import type { DownsizingScenario } from '@/lib/types'

// Note: Mortgage Rate and Remaining Years inputs are now in the main Property section (InputsPage.tsx).
// Downsizing uses the same store fields — no duplication needed.

const SCENARIO_OPTIONS: { value: DownsizingScenario; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Keep current property' },
  { value: 'sell-and-downsize', label: 'Sell & Downsize', description: 'Sell and buy a smaller property' },
  { value: 'sell-and-rent', label: 'Sell & Rent', description: 'Sell and rent instead' },
]

export function DownsizingScenarioForm() {
  const downsizing = usePropertyStore((s) => s.downsizing)
  const setDownsizingField = usePropertyStore((s) => s.setDownsizingField)
  const validationErrors = usePropertyStore((s) => s.validationErrors)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Downsizing Scenario
          <InfoTooltip text="Model selling your property at a target age. Compare keeping it, downsizing, or switching to renting." />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Scenario selector */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit">
          {SCENARIO_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDownsizingField('scenario', opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                downsizing.scenario === opt.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {downsizing.scenario !== 'none' && (
          <>
            {/* Common fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm flex items-center gap-1">
                  Sell at Age
                  <InfoTooltip text="Your age when you plan to sell the property" />
                </Label>
                <NumberInput
                  value={downsizing.sellAge}
                  onChange={(v) => setDownsizingField('sellAge', v)}
                  integer
                />
                {validationErrors['downsizing_sellAge'] && (
                  <p className="text-xs text-destructive">{validationErrors['downsizing_sellAge']}</p>
                )}
              </div>
              <CurrencyInput
                label="Expected Sale Price"
                value={downsizing.expectedSalePrice}
                onChange={(v) => setDownsizingField('expectedSalePrice', v)}
                error={validationErrors['downsizing_expectedSalePrice']}
                tooltip="Expected selling price of your current property"
              />
            </div>

            {/* Sell-and-Downsize fields */}
            {downsizing.scenario === 'sell-and-downsize' && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">New Property</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="New Property Cost"
                    value={downsizing.newPropertyCost}
                    onChange={(v) => setDownsizingField('newPropertyCost', v)}
                    error={validationErrors['downsizing_newPropertyCost']}
                    tooltip="Purchase price of the smaller property"
                  />
                  <PercentInput
                    label="New Mortgage Rate"
                    value={downsizing.newMortgageRate}
                    onChange={(v) => setDownsizingField('newMortgageRate', v)}
                    error={validationErrors['downsizing_newMortgageRate']}
                    tooltip="Expected mortgage rate for the new property"
                  />
                  <div className="space-y-1">
                    <Label className="text-sm flex items-center gap-1">
                      New Mortgage Term (years)
                      <InfoTooltip text="Loan tenure for the new property" />
                    </Label>
                    <NumberInput
                      value={downsizing.newMortgageTerm}
                      onChange={(v) => setDownsizingField('newMortgageTerm', v)}
                      integer
                    />
                    {validationErrors['downsizing_newMortgageTerm'] && (
                      <p className="text-xs text-destructive">{validationErrors['downsizing_newMortgageTerm']}</p>
                    )}
                  </div>
                  <PercentInput
                    label="New Loan-to-Value (LTV)"
                    value={downsizing.newLtv}
                    onChange={(v) => setDownsizingField('newLtv', v)}
                    error={validationErrors['downsizing_newLtv']}
                    tooltip="Loan-to-value ratio for the new property (maximum 75% in Singapore)"
                  />
                </div>
              </div>
            )}

            {/* Sell-and-Rent fields */}
            {downsizing.scenario === 'sell-and-rent' && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-semibold text-muted-foreground">Rental Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CurrencyInput
                    label="Monthly Rent"
                    value={downsizing.monthlyRent}
                    onChange={(v) => setDownsizingField('monthlyRent', v)}
                    error={validationErrors['downsizing_monthlyRent']}
                    tooltip="Expected monthly rent for your new rental home"
                  />
                  <PercentInput
                    label="Annual Rent Growth"
                    value={downsizing.rentGrowthRate}
                    onChange={(v) => setDownsizingField('rentGrowthRate', v)}
                    error={validationErrors['downsizing_rentGrowthRate']}
                    tooltip="Expected annual increase in rent"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
