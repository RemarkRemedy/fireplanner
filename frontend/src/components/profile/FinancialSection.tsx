import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProfileStore } from '@/stores/useProfileStore'
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

export function FinancialSection() {
  const store = useProfileStore()
  const { lockedAssets, addLockedAsset, removeLockedAsset, updateLockedAsset, currentAge } = store
  const mode = useEffectiveMode('section-net-worth')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Financial Snapshot</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CurrencyInput
            label="Liquid Net Worth"
            value={store.liquidNetWorth}
            onChange={(v) => store.setField('liquidNetWorth', v)}
            error={store.validationErrors.liquidNetWorth}
            tooltip="Cash + investments (excludes CPF and property equity)"
          />

          <CurrencyInput
            label="CPF OA Balance"
            value={store.cpfOA}
            onChange={(v) => store.setField('cpfOA', v)}
            error={store.validationErrors.cpfOA}
            tooltip="CPF Ordinary Account balance"
          />

          <CurrencyInput
            label="CPF SA Balance"
            value={store.cpfSA}
            onChange={(v) => store.setField('cpfSA', v)}
            error={store.validationErrors.cpfSA}
            tooltip="CPF Special Account balance"
          />

          <CurrencyInput
            label="CPF MA Balance"
            value={store.cpfMA}
            onChange={(v) => store.setField('cpfMA', v)}
            error={store.validationErrors.cpfMA}
            tooltip="CPF Medisave Account balance"
          />

          <CurrencyInput
            label="SRS Balance"
            value={store.srsBalance}
            onChange={(v) => store.setField('srsBalance', v)}
            error={store.validationErrors.srsBalance}
            tooltip="Supplementary Retirement Scheme balance"
          />

          <CurrencyInput
            label="SRS Annual Contribution"
            value={store.srsAnnualContribution}
            onChange={(v) => store.setField('srsAnnualContribution', v)}
            error={store.validationErrors.srsAnnualContribution}
            tooltip={
              store.residencyStatus === 'foreigner'
                ? 'Annual SRS contribution (max $35,700 for foreigners)'
                : 'Annual SRS contribution (max $15,300 for citizens/PR)'
            }
          />

          {mode === 'advanced' && (
            <PercentInput
              label="SRS Investment Return"
              value={store.srsInvestmentReturn}
              onChange={(v) => store.setField('srsInvestmentReturn', v)}
              error={store.validationErrors.srsInvestmentReturn}
              tooltip="Expected return on SRS investments. Default 4% assumes a balanced portfolio."
            />
          )}

          {mode === 'advanced' && (
            <NumberInput
              label="SRS Drawdown Start Age"
              value={store.srsDrawdownStartAge}
              onChange={(v) => store.setField('srsDrawdownStartAge', v)}
              error={store.validationErrors.srsDrawdownStartAge}
              tooltip="Age to begin SRS withdrawals (10-year drawdown window). Default 63 is the statutory retirement age."
              integer
              min={55}
              max={75}
            />
          )}

          {store.srsAnnualContribution > 0 && (
            <div className="flex items-center gap-3 pb-1">
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
