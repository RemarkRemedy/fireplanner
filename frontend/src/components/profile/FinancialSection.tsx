import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfileStore } from '@/stores/useProfileStore'
import { useHouseholdStore } from '@/stores/useHouseholdStore'
import { useUIStore } from '@/stores/useUIStore'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { useEffectiveMode } from '@/hooks/useEffectiveMode'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { cn } from '@/lib/utils'
import { PersonIndicator } from '@/components/shared/PersonIndicator'

export function FinancialSection() {
  const store = useProfileStore()
  const household = useHouseholdStore()
  const selectedPersonId = useUIStore((s) => s.selectedPersonId)
  const { lockedAssets, addLockedAsset, removeLockedAsset, updateLockedAsset, currentAge } = useProfileStore()
  const mode = useEffectiveMode('section-net-worth')

  const isHouseholdMode = household.householdMode && household.persons.length > 0

  // Get selected person data (for CPF and SRS fields which are per-person)
  const selectedPerson = isHouseholdMode
    ? household.persons.find((p) => p.profile.id === (selectedPersonId || household.persons[0]?.profile.id))
    : null

  // CPF balances - per person
  const cpfOA = selectedPerson ? selectedPerson.cpf.cpfOA : store.cpfOA
  const cpfSA = selectedPerson ? selectedPerson.cpf.cpfSA : store.cpfSA
  const cpfMA = selectedPerson ? selectedPerson.cpf.cpfMA : store.cpfMA
  const cpfRA = selectedPerson ? selectedPerson.cpf.cpfRA : store.cpfRA

  // SRS fields - per person
  const srsBalance = selectedPerson ? selectedPerson.income.srsBalance : store.srsBalance
  const srsAnnualContribution = selectedPerson ? selectedPerson.income.srsAnnualContribution : store.srsAnnualContribution
  const srsInvestmentReturn = selectedPerson ? selectedPerson.income.srsInvestmentReturn : store.srsInvestmentReturn
  const srsDrawdownStartAge = selectedPerson ? selectedPerson.income.srsDrawdownStartAge : store.srsDrawdownStartAge
  const residencyStatus = selectedPerson ? selectedPerson.profile.residencyStatus : store.residencyStatus

  // Setter functions for CPF
  const setCpfOA = (v: number) => {
    if (selectedPerson) {
      household.updatePersonCpf(selectedPerson.profile.id, { cpfOA: v })
    } else {
      store.setField('cpfOA', v)
    }
  }
  const setCpfSA = (v: number) => {
    if (selectedPerson) {
      household.updatePersonCpf(selectedPerson.profile.id, { cpfSA: v })
    } else {
      store.setField('cpfSA', v)
    }
  }
  const setCpfMA = (v: number) => {
    if (selectedPerson) {
      household.updatePersonCpf(selectedPerson.profile.id, { cpfMA: v })
    } else {
      store.setField('cpfMA', v)
    }
  }
  const setCpfRA = (v: number) => {
    if (selectedPerson) {
      household.updatePersonCpf(selectedPerson.profile.id, { cpfRA: v })
    } else {
      store.setField('cpfRA', v)
    }
  }

  // Setter functions for SRS
  const setSrsBalance = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { srsBalance: v })
    } else {
      store.setField('srsBalance', v)
    }
  }
  const setSrsAnnualContribution = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { srsAnnualContribution: v })
    } else {
      store.setField('srsAnnualContribution', v)
    }
  }
  const setSrsInvestmentReturn = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { srsInvestmentReturn: v })
    } else {
      store.setField('srsInvestmentReturn', v)
    }
  }
  const setSrsDrawdownStartAge = (v: number) => {
    if (selectedPerson) {
      household.updatePersonIncome(selectedPerson.profile.id, { srsDrawdownStartAge: v })
    } else {
      store.setField('srsDrawdownStartAge', v)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Financial Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Household Assets Section */}
        {isHouseholdMode && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Household Assets
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CurrencyInput
                label="Liquid Net Worth"
                value={store.liquidNetWorth}
                onChange={(v) => store.setField('liquidNetWorth', v)}
                error={store.validationErrors.liquidNetWorth}
                tooltip="Cash + investments (excludes CPF and property equity). Shared at household level."
              />
            </div>
          </div>
        )}

        {/* Individual Assets Section (or main section in single-person mode) */}
        <div>
          {isHouseholdMode && (
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Individual Assets
              </h3>
              <PersonIndicator />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isHouseholdMode && (
              <CurrencyInput
                label="Liquid Net Worth"
                value={store.liquidNetWorth}
                onChange={(v) => store.setField('liquidNetWorth', v)}
                error={store.validationErrors.liquidNetWorth}
                tooltip="Cash + investments (excludes CPF and property equity)"
              />
            )}

            <CurrencyInput
              label="CPF OA Balance"
              value={cpfOA}
              onChange={setCpfOA}
              error={store.validationErrors.cpfOA}
              tooltip="CPF Ordinary Account balance"
            />

            <CurrencyInput
              label="CPF SA Balance"
              value={cpfSA}
              onChange={setCpfSA}
              error={store.validationErrors.cpfSA}
              tooltip="CPF Special Account balance"
            />

            <CurrencyInput
              label="CPF MA Balance"
              value={cpfMA}
              onChange={setCpfMA}
              error={store.validationErrors.cpfMA}
              tooltip="CPF Medisave Account balance"
            />

            <CurrencyInput
              label="CPF RA Balance"
              value={cpfRA}
              onChange={setCpfRA}
              error={store.validationErrors.cpfRA}
              tooltip="CPF Retirement Account balance"
            />

            <CurrencyInput
              label="SRS Balance"
              value={srsBalance}
              onChange={setSrsBalance}
              error={store.validationErrors.srsBalance}
              tooltip="Supplementary Retirement Scheme balance"
            />

            <CurrencyInput
              label="SRS Annual Contribution"
              value={srsAnnualContribution}
              onChange={setSrsAnnualContribution}
              error={store.validationErrors.srsAnnualContribution}
              tooltip={
                residencyStatus === 'foreigner'
                  ? 'Annual SRS contribution (max $35,700 for foreigners)'
                  : 'Annual SRS contribution (max $15,300 for citizens/PR)'
              }
            />

            {mode === 'advanced' && (
              <PercentInput
                label="SRS Investment Return"
                value={srsInvestmentReturn}
                onChange={setSrsInvestmentReturn}
                error={store.validationErrors.srsInvestmentReturn}
                tooltip="Expected return on SRS investments. Default 4% assumes a balanced portfolio."
              />
            )}

            {mode === 'advanced' && (
              <NumberInput
                label="SRS Drawdown Start Age"
                value={srsDrawdownStartAge}
                onChange={setSrsDrawdownStartAge}
                error={store.validationErrors.srsDrawdownStartAge}
                tooltip="Age to begin SRS withdrawals (10-year drawdown window). Default 63 is the statutory retirement age."
                integer
                min={55}
                max={75}
              />
            )}
          </div>

          {srsAnnualContribution > 0 && (
            <div className="flex items-center gap-3 pb-1 mt-4">
              <Switch
                id="srs-post-fire-toggle"
                checked={store.srsPostFireEnabled}
                onCheckedChange={(checked) => store.setField('srsPostFireEnabled', checked)}
              />
              <Label htmlFor="srs-post-fire-toggle" className="text-sm cursor-pointer">
                Continue SRS during post-FIRE employment
              </Label>
              <InfoTooltip text="Enable SRS contributions during Barista FIRE years when you have employment income streams active after your FIRE age. Off by default since barista income is typically lower." />
            </div>
          )}

          {/* Locked Assets */}
          <div className="col-span-full mt-4">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-medium">Locked Assets</h4>
              <InfoTooltip text="Illiquid holdings that become accessible at a specific age (e.g., employer RSUs, fixed deposits, foreign pensions). Entered separately from Liquid Net Worth — not double-counted." />
            </div>
            {lockedAssets.map((asset, i) => (
              <div key={asset.id}>
                {/* Desktop row */}
                <div className="hidden md:grid grid-cols-[1fr_120px_80px_80px_32px] gap-2 mb-2 items-end">
                  <div>
                    {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Name</Label>}
                    <Input
                      value={asset.name}
                      onChange={(e) => updateLockedAsset(asset.id, { name: e.target.value })}
                      placeholder="e.g., Employer RSUs"
                      className="h-9"
                    />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>}
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm z-10">$</span>
                      <NumberInput
                        value={asset.amount}
                        onChange={(v) => updateLockedAsset(asset.id, { amount: v })}
                        integer
                        formatWithCommas
                        className="pl-7 border-blue-300 h-9"
                      />
                    </div>
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Unlock Age</Label>}
                    <NumberInput
                      value={asset.unlockAge}
                      onChange={(v) => updateLockedAsset(asset.id, { unlockAge: v })}
                    />
                  </div>
                  <div>
                    {i === 0 && <Label className="text-xs text-muted-foreground mb-1 block">Growth</Label>}
                    <PercentInput
                      value={asset.growthRate}
                      onChange={(v) => updateLockedAsset(asset.id, { growthRate: v })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-9 w-9", i === 0 && "mt-5")}
                    onClick={() => removeLockedAsset(asset.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* Mobile card */}
                <div className="md:hidden border rounded-lg p-3 mb-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input
                      value={asset.name}
                      onChange={(e) => updateLockedAsset(asset.id, { name: e.target.value })}
                      placeholder="e.g., Employer RSUs"
                      className="h-9 flex-1 mr-2"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeLockedAsset(asset.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs z-10">$</span>
                        <NumberInput
                          value={asset.amount}
                          onChange={(v) => updateLockedAsset(asset.id, { amount: v })}
                          integer
                          formatWithCommas
                          className="pl-5 border-blue-300 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Age</Label>
                      <NumberInput
                        value={asset.unlockAge}
                        onChange={(v) => updateLockedAsset(asset.id, { unlockAge: v })}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Growth</Label>
                      <PercentInput
                        value={asset.growthRate}
                        onChange={(v) => updateLockedAsset(asset.id, { growthRate: v })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {lockedAssets.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => addLockedAsset({
                  id: crypto.randomUUID(),
                  name: '',
                  amount: 0,
                  unlockAge: currentAge + 10,
                  growthRate: 0,
                })}
                className="mt-1"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Locked Asset
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
