import { useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { useProfileStore } from '@/stores/useProfileStore'
import { formatCurrency } from '@/lib/utils'
import { calculateHealthcareCostAtAge, ISP_TIER_ORDER } from '@/lib/calculations/healthcare'
import { interpolateOopMultiplier } from '@/lib/data/healthcareOop'
import type { HealthcareConfig, IspTierOption, OopModel, OopCurveVariant } from '@/lib/types'

const ISP_TIER_OPTIONS: { value: IspTierOption; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'MediShield Life only' },
  { value: 'basic', label: 'Basic', description: 'B2/C ward coverage' },
  { value: 'standard', label: 'Standard', description: 'B1 ward coverage' },
  { value: 'enhanced', label: 'Enhanced', description: 'A ward / private hospital' },
]

const OOP_MODEL_OPTIONS: { value: OopModel; label: string }[] = [
  { value: 'age-curve', label: 'Age-Dependent (Recommended)' },
  { value: 'fixed', label: 'Fixed Annual Amount' },
]

const PREVIEW_AGES = [40, 50, 60, 70, 80, 90]

export function HealthcareSection() {
  const config = useProfileStore((s) => s.healthcareConfig)
  const retirementAge = useProfileStore((s) => s.retirementAge)
  const currentAge = useProfileStore((s) => s.currentAge)
  const setField = useProfileStore((s) => s.setField)
  const validationErrors = useProfileStore((s) => s.validationErrors)

  const hasDowngrade = config.ispDowngradeTier !== undefined && config.ispDowngradeAge !== undefined

  const updateConfig = useCallback(
    <K extends keyof HealthcareConfig>(key: K, value: HealthcareConfig[K]) => {
      const updated = { ...config, [key]: value }
      // Auto-clear downgrade if primary tier changes to same or lower than downgrade tier
      if (key === 'ispTier' && updated.ispDowngradeTier !== undefined) {
        const newTier = value as IspTierOption
        if (ISP_TIER_ORDER[newTier] <= ISP_TIER_ORDER[updated.ispDowngradeTier]) {
          updated.ispDowngradeTier = undefined
          updated.ispDowngradeAge = undefined
        }
      }
      setField('healthcareConfig', updated)
    },
    [config, setField],
  )

  // Scale OOP presets to the user's current age
  const ageMultiplier = useMemo(
    () => interpolateOopMultiplier(currentAge, config.oopCurveVariant ?? 'study-backed'),
    [currentAge, config.oopCurveVariant],
  )

  const oopPresets = useMemo(() => [
    { label: 'Bottom-Up Estimate', amount: Math.round(1170 * ageMultiplier), source: 'GP + dental + optical + medications' },
    { label: 'World Bank (Nominal)', amount: Math.round(1335 * ageMultiplier), source: 'World Bank out-of-pocket per capita 2023' },
    { label: 'SingStat HES 2023', amount: Math.round(1896 * ageMultiplier), source: 'SingStat Household Expenditure Survey' },
    { label: 'World Bank (PPP)', amount: Math.round(2200 * ageMultiplier), source: 'World Bank PPP-adjusted 2023' },
  ], [ageMultiplier])

  // Cost preview at key ages
  const previewRows = useMemo(() => {
    if (!config.enabled) return []
    return PREVIEW_AGES.map((age) => calculateHealthcareCostAtAge(config, age))
  }, [config])

  const costAtRetirement = useMemo(() => {
    if (!config.enabled) return null
    return calculateHealthcareCostAtAge(config, retirementAge)
  }, [config, retirementAge])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            Healthcare & Insurance
            <InfoTooltip text="Model Singapore healthcare costs including MediShield Life, Integrated Shield Plans (ISP), CareShield LIFE, and out-of-pocket expenses. Costs are age-dependent and increase with age." />
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => updateConfig('enabled', checked)}
          />
        </CardTitle>
      </CardHeader>
      {config.enabled && (
        <CardContent className="space-y-5">
          {/* Insurance Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-1">
                MediShield Life
                <InfoTooltip text="National health insurance scheme. Premiums are fully payable from MediSave. Mandatory for all Singapore citizens and PRs." source="CPF Board" sourceUrl="https://www.cpf.gov.sg/member/healthcare-financing/medishield-life/medishield-life-premiums-and-subsidies" />
              </Label>
              <Switch
                checked={config.mediShieldLifeEnabled}
                onCheckedChange={(checked) => updateConfig('mediShieldLifeEnabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-1">
                CareShield LIFE
                <InfoTooltip text="Long-term care insurance. Premiums paid from age 30 to 67. Mandatory for those born 1980 or later." source="CareShield LIFE" sourceUrl="https://www.careshieldlife.gov.sg" />
              </Label>
              <Switch
                checked={config.careShieldLifeEnabled}
                onCheckedChange={(checked) => updateConfig('careShieldLifeEnabled', checked)}
              />
            </div>
          </div>

          {/* ISP Tier Selector */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1">
              Integrated Shield Plan (ISP) Tier
              <InfoTooltip text="Optional upgrade to MediShield Life for higher ward class and private hospital coverage. Additional premiums vary by tier and age." />
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {ISP_TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateConfig('ispTier', opt.value)}
                  className={`p-2 rounded-md border text-sm text-left transition-colors ${
                    config.ispTier === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground">{opt.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* ISP Tier Downgrade */}
          {config.ispTier !== 'none' && (
            <div className="space-y-3 pl-2 border-l-2 border-muted">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-1">
                  Shield Plan Tier Downgrade
                  <InfoTooltip text="Optionally plan to downgrade your Integrated Shield Plan tier at a later age to reduce premiums. Common strategy: Enhanced to Basic at 70 when hospitalization risk is better covered by MediSave." />
                </Label>
                <Switch
                  checked={hasDowngrade}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Default to 'none' tier at age 70 (or currentAge + 1 if older)
                      const defaultAge = Math.max(currentAge + 1, 70)
                      updateConfig('ispDowngradeTier', 'none')
                      setField('healthcareConfig', {
                        ...config,
                        ispDowngradeTier: 'none',
                        ispDowngradeAge: defaultAge,
                      })
                    } else {
                      setField('healthcareConfig', {
                        ...config,
                        ispDowngradeTier: undefined,
                        ispDowngradeAge: undefined,
                      })
                    }
                  }}
                />
              </div>

              {hasDowngrade && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Downgrade to</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {ISP_TIER_OPTIONS
                        .filter((opt) => ISP_TIER_ORDER[opt.value] < ISP_TIER_ORDER[config.ispTier])
                        .map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => updateConfig('ispDowngradeTier', opt.value)}
                            className={`p-2 rounded-md border text-sm text-left transition-colors ${
                              config.ispDowngradeTier === opt.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      Downgrade at age
                    </Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={currentAge + 1}
                      max={120}
                      value={config.ispDowngradeAge ?? ''}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v)) {
                          updateConfig('ispDowngradeAge', v)
                        }
                      }}
                      className="w-24 border-blue-300"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OOP Configuration */}
          <div className="space-y-3">
            <Label className="text-sm flex items-center gap-1">
              Out-of-Pocket Model
              <InfoTooltip text="Out-of-pocket costs (GP visits, medications, dental, optical) increase with age. 'Age-Dependent' uses a research-based multiplier curve." />
            </Label>
            <div className="flex gap-2">
              {OOP_MODEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => updateConfig('oopModel', opt.value)}
                  className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                    config.oopModel === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-1">
                Out-of-Pocket Presets
                <InfoTooltip text={`Research-backed annual out-of-pocket estimates scaled to your age (${currentAge}). Sources: World Bank health expenditure data (2023), SingStat Household Expenditure Survey 2023, and bottom-up cost modelling. Medical inflation scales this up over time.`} />
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {oopPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => updateConfig('oopBaseAmount', preset.amount)}
                    className={`p-2 rounded-md border text-sm text-left transition-colors ${
                      config.oopBaseAmount === preset.amount
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium">{preset.label}</div>
                    <div className="text-xs text-muted-foreground">${preset.amount.toLocaleString()}/yr — {preset.source}</div>
                  </button>
                ))}
              </div>
            </div>

            {config.oopModel === 'age-curve' && (
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  Age Multiplier Curve
                  <InfoTooltip text="Controls how steeply out-of-pocket costs increase with age. 'Study-Backed' uses compressed multipliers from academic research (PMC4862090) reflecting Singapore's elderly subsidies. 'Conservative' assumes higher costs for private care or no means-tested subsidies." />
                </Label>
                <div className="flex gap-2">
                  {([
                    { value: 'study-backed' as OopCurveVariant, label: 'Study-Backed (Recommended)', description: 'Accounts for SG elderly subsidies' },
                    { value: 'conservative' as OopCurveVariant, label: 'Conservative', description: 'Private care / higher costs' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateConfig('oopCurveVariant', opt.value)}
                      className={`p-2 rounded-md border text-sm text-left transition-colors flex-1 ${
                        (config.oopCurveVariant ?? 'study-backed') === opt.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <CurrencyInput
              label={config.oopModel === 'age-curve' ? `Out-of-Pocket Base Amount (at age ${currentAge})` : 'Annual Out-of-Pocket Amount'}
              value={config.oopBaseAmount}
              onChange={(v) => updateConfig('oopBaseAmount', v)}
              error={validationErrors['healthcareConfig.oopBaseAmount']}
              tooltip={
                config.oopModel === 'age-curve'
                  ? `Your annual out-of-pocket healthcare spending at age ${currentAge}. The age multiplier curve scales this up as you get older.`
                  : 'Fixed annual out-of-pocket healthcare spending, applied at every age.'
              }
            />

            <PercentInput
              label="Medical Inflation Rate"
              value={config.oopInflationRate}
              onChange={(v) => updateConfig('oopInflationRate', v)}
              tooltip="Annual increase in out-of-pocket costs above general inflation. Singapore CPI Healthcare averaged 2.24% over 20 years; 3% is moderately conservative. Set to 0% for no medical inflation. Source: SingStat CPI Health."
            />
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground italic">
            Use these estimates as a starting point for your plan. Actual costs vary by individual health, lifestyle, and care choices. Review and adjust the inputs above to match your situation.
          </p>

          {/* MediSave Top-Up */}
          <CurrencyInput
            label="Annual MediSave Top-Up"
            value={config.mediSaveTopUpAnnual}
            onChange={(v) => updateConfig('mediSaveTopUpAnnual', v)}
            error={validationErrors['healthcareConfig.mediSaveTopUpAnnual']}
            tooltip="Voluntary annual top-up to MediSave Account (MA). Maximum $37,740 (current Basic Healthcare Sum cap). Helps offset future healthcare premiums. Source: CPF Board."
          />

          {/* Cost Preview Table */}
          {previewRows.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Cost Preview by Age</Label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 pr-2 text-muted-foreground font-medium">Age</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Premiums</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Out-of-Pocket</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Total</th>
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-medium">Cash Outlay</th>
                      {config.oopInflationRate > 0 && (
                        <th className="text-right py-1.5 pl-2 text-muted-foreground font-medium">
                          Today's dollars
                          <InfoTooltip text="Cash outlay with medical inflation removed from out-of-pocket costs, showing costs in today's purchasing power. Premiums are already in 2025 dollars." />
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const inflationYears = Math.max(0, row.age - currentAge)
                      const deflator = Math.pow(1 + config.oopInflationRate, inflationYears)
                      const todaysCashOutlay = (row.cashOutlay - row.oopExpense) + row.oopExpense / deflator
                      return (
                        <tr key={row.age} className="border-b border-muted/50">
                          <td className="py-1.5 pr-2 font-medium">{row.age}</td>
                          <td className="text-right py-1.5 px-2">
                            {formatCurrency(row.mediShieldLifePremium + row.ispAdditionalPremium + row.careShieldLifePremium)}
                          </td>
                          <td className="text-right py-1.5 px-2">{formatCurrency(row.oopExpense)}</td>
                          <td className="text-right py-1.5 px-2">{formatCurrency(row.totalCost)}</td>
                          <td className="text-right py-1.5 px-2 font-semibold text-primary">
                            {formatCurrency(row.cashOutlay)}
                          </td>
                          {config.oopInflationRate > 0 && (
                            <td className="text-right py-1.5 pl-2 text-muted-foreground">
                              {formatCurrency(todaysCashOutlay)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Cash outlay = total cost minus MediSave-deductible portion. Premiums are from CPF Board / MOH data (2025).
                {config.oopInflationRate > 0 && ` Today's dollars removes ${(config.oopInflationRate * 100).toFixed(1)}% medical inflation from out-of-pocket costs to show costs in current purchasing power.`}
              </p>
            </div>
          )}

          {/* Summary at retirement */}
          {costAtRetirement && (
            <div className="p-2 bg-muted/50 rounded text-sm">
              <span className="text-muted-foreground">At retirement (age {retirementAge}): </span>
              <span className="font-semibold">{formatCurrency(costAtRetirement.cashOutlay)}/yr cash outlay</span>
              <span className="text-muted-foreground"> out of {formatCurrency(costAtRetirement.totalCost)}/yr total</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
