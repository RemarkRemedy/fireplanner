import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'
import { PercentInput } from '@/components/shared/PercentInput'
import { computeBlendedReturn, type IlpChargeRule, type IlpEventChargeRule, type IlpPolicyEvent, type IlpPolicyInput } from '@/lib/calculations/ilp'
import { EEC_PRESETS } from '@/lib/data/ilpDefaults'
import { useIlpStore } from '@/stores/useIlpStore'
import { cn } from '@/lib/utils'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatIlpPercent } from './formatters'
import { Badge } from '@/components/ui/badge'

const USE_TOP_UP_ROUTING_VALUE = '__top-up-routing__'

interface PolicyInputFormProps {
  policy: IlpPolicyInput | null
  issues: string[]
}

function createDraftId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function humanizeCatalogTag(value: string): string {
  return value
    .replace(/^branch:/, '')
    .replace(/-/g, ' ')
}

export function PolicyInputForm({ policy, issues }: PolicyInputFormProps) {
  const updatePolicy = useIlpStore((state) => state.updatePolicy)
  const setFund = useIlpStore((state) => state.setFund)
  const addFund = useIlpStore((state) => state.addFund)
  const removeFund = useIlpStore((state) => state.removeFund)
  const setAccount = useIlpStore((state) => state.setAccount)
  const addAccount = useIlpStore((state) => state.addAccount)
  const removeAccount = useIlpStore((state) => state.removeAccount)
  const setBonus = useIlpStore((state) => state.setBonus)
  const addBonus = useIlpStore((state) => state.addBonus)
  const removeBonus = useIlpStore((state) => state.removeBonus)

  if (!policy) return null

  const contributionShareTotal = policy.accounts.reduce((sum, account) => sum + account.contributionShare, 0)
  const contributionShareTarget = policy.monthlyContribution > 0 ? 1 : 0
  const contributionShareValid = Math.abs(contributionShareTotal - contributionShareTarget) < 0.001
  const fundAllocationTotal = policy.funds.reduce((sum, fund) => sum + fund.allocation, 0)
  const fundAllocationValid = Math.abs(fundAllocationTotal - 1) < 0.001
  const manualChargeWarnings = (policy.chargeRules ?? [])
    .filter((rule) => (
      rule.basis === 'fixed-annual'
      && rule.requiresManualInput
      && rule.amount === 0
      && (rule.amountSchedule?.length ?? 0) === 0
    ))
    .map((rule) => `${rule.label} is still zero. Enter an annualized estimate before trusting the analysis.`)
  const eecChartData = policy.eecTable.map((rate, index) => ({ year: index + 1, rate: rate * 100 }))
  const updateChargeRules = (chargeRules: IlpChargeRule[]) => updatePolicy(policy.id, { chargeRules })
  const updatePolicyEvents = (policyEvents: IlpPolicyEvent[]) => updatePolicy(policy.id, { policyEvents })
  const updateEventChargeRules = (eventChargeRules: IlpEventChargeRule[]) => updatePolicy(policy.id, { eventChargeRules })

  return (
    <div className="space-y-4">
      {policy.catalogSource && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Seeded from catalog template</AlertTitle>
          <AlertDescription className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant={policy.catalogSource.supportStatus === 'supported' ? 'default' : 'secondary'}>
                {policy.catalogSource.supportStatus === 'supported' ? 'Supported template' : 'Partial template'}
              </Badge>
              <Badge variant="outline">
                {policy.catalogSource.economicsStatus === 'supported' ? 'Modeled economics' : 'Modeled subset'}
              </Badge>
            </div>
            <p>
              {policy.catalogSource.productName} ({policy.catalogSource.variantLabel}) from catalog version {policy.catalogSource.catalogVersion}.
              Review personal fields before trusting the analysis: monthly contribution, months already paid, current policy year, and current account values.
            </p>
            <p>
              {policy.catalogSource.supportStatus === 'supported'
                ? 'This template is release-gated only for the modeled economics listed in the catalog. Anything outside that boundary still requires document review.'
                : 'This template is only partially modeled. Use the analysis as a subset view and verify all remaining product mechanics against the source documents.'}
            </p>
            {policy.catalogSource.metadataOnlyBehaviors.length > 0 && (
              <p>
                Metadata-only behaviors still outside the calculator: {policy.catalogSource.metadataOnlyBehaviors.map(humanizeCatalogTag).join(', ')}.
              </p>
            )}
            {policy.catalogWarnings && policy.catalogWarnings.length > 0 && (
              <ul className="list-disc pl-5">
                {policy.catalogWarnings.slice(0, 4).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {manualChargeWarnings.length > 0 && (
              <ul className="list-disc pl-5 text-amber-700 dark:text-amber-300">
                {manualChargeWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {issues.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Policy needs attention before analysis updates</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {issues.slice(0, 6).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Accordion type="multiple" defaultValue={['policy', 'accounts', 'eec', 'funds', 'bonuses', 'charges', 'events', 'settings']} className="rounded-lg border bg-card px-4">
        <AccordionItem value="policy">
          <AccordionTrigger>Policy Details</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="ilp-name">Policy Name</Label>
              <Input
                id="ilp-name"
                className="border-blue-300"
                value={policy.name}
                onChange={(event) => updatePolicy(policy.id, { name: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ilp-insurer">Insurer</Label>
              <Input
                id="ilp-insurer"
                className="border-blue-300"
                value={policy.insurer}
                onChange={(event) => updatePolicy(policy.id, { insurer: event.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Currency</Label>
              <Select
                value={policy.currency}
                onValueChange={(value) => updatePolicy(policy.id, { currency: value as IlpPolicyInput['currency'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SGD">SGD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <CurrencyInput
              label={`Monthly Contribution (${policy.currency})`}
              value={policy.monthlyContribution}
              onChange={(value) => updatePolicy(policy.id, { monthlyContribution: value })}
            />
            <NumberInput
              label="Months Already Paid"
              value={policy.monthsAlreadyPaid}
              onChange={(value) => updatePolicy(policy.id, { monthsAlreadyPaid: value })}
              integer
              min={0}
            />
            <NumberInput
              label="Current Policy Year"
              value={policy.currentPolicyYear}
              onChange={(value) => updatePolicy(policy.id, { currentPolicyYear: value })}
              integer
              min={1}
            />
            <NumberInput
              label="MIP Length"
              value={policy.mipLength}
              onChange={(value) => updatePolicy(policy.id, { mipLength: value })}
              integer
              min={1}
            />
            <NumberInput
              label="Post-MIP Years"
              value={policy.postMipYears}
              onChange={(value) => updatePolicy(policy.id, { postMipYears: value })}
              integer
              min={0}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="accounts">
          <AccordionTrigger>Accounts</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span>
                Contribution share total: <span className={cn('font-semibold', contributionShareValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                  {formatIlpPercent(contributionShareTotal)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Expected {formatIlpPercent(contributionShareTarget)}
              </span>
            </div>

            {policy.accounts.map((account, index) => (
              <Card key={account.id}>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Account ID</Label>
                    <Input
                      className="border-blue-300"
                      value={account.id}
                      onChange={(event) => setAccount(policy.id, index, { ...account, id: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      className="border-blue-300"
                      value={account.label}
                      onChange={(event) => setAccount(policy.id, index, { ...account, label: event.target.value })}
                    />
                  </div>
                  <PercentInput
                    label="Fee Rate"
                    value={account.feeRate}
                    onChange={(value) => setAccount(policy.id, index, { ...account, feeRate: value })}
                  />
                  <CurrencyInput
                    label={`Current Value (${policy.currency})`}
                    value={account.currentValue}
                    onChange={(value) => setAccount(policy.id, index, { ...account, currentValue: value })}
                  />
                  <PercentInput
                    label="Contribution Share"
                    value={account.contributionShare}
                    onChange={(value) => setAccount(policy.id, index, { ...account, contributionShare: value })}
                  />
                  <div className="space-y-2">
                    <Label className="text-sm">Subject to EEC</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.subjectToEec}
                        onChange={(event) => setAccount(policy.id, index, { ...account, subjectToEec: event.target.checked })}
                      />
                      Apply EEC to this account on surrender
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Post-MIP Fee Override</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={account.postMipFeeRate != null}
                        onChange={(event) => setAccount(policy.id, index, {
                          ...account,
                          postMipFeeRate: event.target.checked ? account.feeRate : null,
                        })}
                      />
                      Override fee after MIP ends
                    </label>
                  </div>
                  {account.postMipFeeRate != null && (
                    <PercentInput
                      label="Post-MIP Fee Rate"
                      value={account.postMipFeeRate}
                      onChange={(value) => setAccount(policy.id, index, { ...account, postMipFeeRate: value })}
                    />
                  )}
                  <div className="flex items-end justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => removeAccount(policy.id, index)}
                      disabled={policy.accounts.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Account
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addAccount(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="eec">
          <AccordionTrigger>EEC Table</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
              <div className="space-y-2">
                <Label>Load Preset</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    const preset = EEC_PRESETS[value as keyof typeof EEC_PRESETS]
                    if (!preset) return
                    updatePolicy(policy.id, {
                      eecTable: [...preset],
                      mipLength: preset.length,
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a common schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(EEC_PRESETS).map((presetName) => (
                      <SelectItem key={presetName} value={presetName}>{presetName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Presets are just a starting point. Edit each year to match your policy document.
                </p>
              </div>

              <div className="h-44 rounded-md border p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eecChartData}>
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(value: number) => `${value.toFixed(0)}%`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                    <Line type="monotone" dataKey="rate" stroke="hsl(var(--chart-danger))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Policy Year</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">EEC Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {policy.eecTable.map((rate, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">
                        <PercentInput
                          value={rate}
                          onChange={(value) => {
                            const eecTable = [...policy.eecTable]
                            eecTable[index] = value
                            updatePolicy(policy.id, { eecTable })
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="funds">
          <AccordionTrigger>Fund Allocations</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-4">
                <span className={cn('font-medium', fundAllocationValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>
                  Allocation total: {formatIlpPercent(fundAllocationTotal)}
                </span>
                <span className="text-muted-foreground">Low: {formatIlpPercent(computeBlendedReturn(policy.funds, 'low'))}</span>
                <span className="text-muted-foreground">Mid: {formatIlpPercent(computeBlendedReturn(policy.funds, 'mid'))}</span>
                <span className="text-muted-foreground">High: {formatIlpPercent(computeBlendedReturn(policy.funds, 'high'))}</span>
              </div>
            </div>

            {policy.funds.map((fund, index) => (
              <Card key={`${fund.name}-${index}`}>
                <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label>Fund Name</Label>
                    <Input
                      className="border-blue-300"
                      value={fund.name}
                      onChange={(event) => setFund(policy.id, index, { ...fund, name: event.target.value })}
                    />
                  </div>
                  <PercentInput
                    label="Allocation"
                    value={fund.allocation}
                    onChange={(value) => setFund(policy.id, index, { ...fund, allocation: value })}
                  />
                  <PercentInput
                    label="OCF"
                    value={fund.ocf}
                    onChange={(value) => setFund(policy.id, index, { ...fund, ocf: value })}
                  />
                  <PercentInput
                    label="Gross Return Low"
                    value={fund.grossReturnLow}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnLow: value })}
                  />
                  <PercentInput
                    label="Gross Return Mid"
                    value={fund.grossReturnMid}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnMid: value })}
                  />
                  <PercentInput
                    label="Gross Return High"
                    value={fund.grossReturnHigh}
                    onChange={(value) => setFund(policy.id, index, { ...fund, grossReturnHigh: value })}
                  />
                  <div className="flex items-end justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      onClick={() => removeFund(policy.id, index)}
                      disabled={policy.funds.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Fund
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addFund(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Fund
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="bonuses">
          <AccordionTrigger>Bonus Rules</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              `premium-allocation` and `one-time` bonuses are split evenly across targeted accounts so the bonus dollars are not accidentally duplicated.
            </p>

            {policy.bonuses.map((bonus, index) => (
              <Card key={`${bonus.label}-${index}`}>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Label</Label>
                      <Input
                        className="border-blue-300"
                        value={bonus.label}
                        onChange={(event) => setBonus(policy.id, index, { ...bonus, label: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Type</Label>
                      <Select
                        value={bonus.type}
                        onValueChange={(value) => setBonus(policy.id, index, { ...bonus, type: value as typeof bonus.type })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="power-up">Power-up</SelectItem>
                          <SelectItem value="loyalty">Loyalty</SelectItem>
                          <SelectItem value="allocation">Allocation</SelectItem>
                          <SelectItem value="sign-up">Sign-up</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Mode</Label>
                      <Select
                        value={bonus.mode}
                        onValueChange={(value) => setBonus(policy.id, index, { ...bonus, mode: value as typeof bonus.mode })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual-rate">Annual Rate</SelectItem>
                          <SelectItem value="premium-allocation">Premium Allocation</SelectItem>
                          <SelectItem value="one-time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bonus.mode !== 'one-time' ? (
                      <PercentInput
                        label="Rate"
                        value={bonus.rate}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, rate: value })}
                      />
                    ) : (
                      <CurrencyInput
                        label={`Amount (${policy.currency})`}
                        value={bonus.amount}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, amount: value })}
                      />
                    )}
                    {bonus.mode === 'one-time' && (
                      <PercentInput
                        label="Rate (unused)"
                        value={bonus.rate}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, rate: value })}
                      />
                    )}
                    {bonus.mode !== 'one-time' && (
                      <CurrencyInput
                        label={`Amount (${policy.currency}, optional)`}
                        value={bonus.amount}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, amount: value })}
                      />
                    )}
                    <NumberInput
                      label="Start Policy Year"
                      value={bonus.startPolicyYear}
                      onChange={(value) => setBonus(policy.id, index, { ...bonus, startPolicyYear: value })}
                      integer
                      min={1}
                    />
                    <div className="space-y-2">
                      <Label className="text-sm">Open-ended</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bonus.endPolicyYear == null}
                          onChange={(event) => setBonus(policy.id, index, {
                            ...bonus,
                            endPolicyYear: event.target.checked ? null : bonus.startPolicyYear,
                          })}
                        />
                        No end year
                      </label>
                    </div>
                    {bonus.endPolicyYear != null && (
                      <NumberInput
                        label="End Policy Year"
                        value={bonus.endPolicyYear}
                        onChange={(value) => setBonus(policy.id, index, { ...bonus, endPolicyYear: value })}
                        integer
                        min={bonus.startPolicyYear}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Applies To Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={bonus.appliesTo.length === 0}
                          onChange={(event) => setBonus(policy.id, index, {
                            ...bonus,
                            appliesTo: event.target.checked ? [] : bonus.appliesTo,
                          })}
                        />
                        All accounts
                      </label>
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            disabled={bonus.appliesTo.length === 0}
                            checked={bonus.appliesTo.includes(account.id)}
                            onChange={(event) => setBonus(policy.id, index, {
                              ...bonus,
                              appliesTo: event.target.checked
                                ? [...bonus.appliesTo, account.id]
                                : bonus.appliesTo.filter((accountId) => accountId !== account.id),
                            })}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" className="text-destructive" onClick={() => removeBonus(policy.id, index)}>
                      <Trash2 className="h-4 w-4" />
                      Remove Bonus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" onClick={() => addBonus(policy.id)}>
              <Plus className="h-4 w-4" />
              Add Bonus
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="charges">
          <AccordionTrigger>Charge Rules</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Recurring Charge Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Use this for modeled annual charges that are not captured by the base account fee rates, including fixed annual assurance-charge placeholders and fallback deduction accounts.
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={() => updateChargeRules([
                  ...(policy.chargeRules ?? []),
                  {
                    id: createDraftId('charge'),
                    label: `Charge Rule ${(policy.chargeRules?.length ?? 0) + 1}`,
                    basis: 'fixed-annual',
                    activeWindow: 'policy-term',
                    appliesTo: policy.accounts[0] ? [policy.accounts[0].id] : [],
                    fallbackAppliesTo: [],
                    amountSchedule: [],
                    rate: 0,
                    amount: 0,
                    allocation: 'equal-split',
                  },
                ])}
              >
                <Plus className="h-4 w-4" />
                Add Charge Rule
              </Button>
            </div>

            {(policy.chargeRules ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No recurring charge rules configured.
                </CardContent>
              </Card>
            ) : (policy.chargeRules ?? []).map((rule, index) => (
              <Card key={rule.id}>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Label</Label>
                      <Input
                        className="border-blue-300"
                        value={rule.label}
                        onChange={(event) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, label: event.target.value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label>Basis</Label>
                      <Select
                        value={rule.basis}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = {
                            ...rule,
                            basis: value as IlpChargeRule['basis'],
                            amountSchedule: value === 'fixed-annual' ? (rule.amountSchedule ?? []) : undefined,
                          }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed-annual">Fixed Annual</SelectItem>
                          <SelectItem value="account-value">Account Value</SelectItem>
                          <SelectItem value="annual-contribution">Annual Contribution</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Active Window</Label>
                      <Select
                        value={rule.activeWindow}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, activeWindow: value as IlpChargeRule['activeWindow'] }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="during-mip">During MIP</SelectItem>
                          <SelectItem value="after-mip">After MIP</SelectItem>
                          <SelectItem value="policy-term">Policy Term</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label>Allocation</Label>
                      <Select
                        value={rule.allocation}
                        onValueChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, allocation: value as IlpChargeRule['allocation'] }
                          updateChargeRules(nextRules)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equal-split">Equal Split</SelectItem>
                          <SelectItem value="pro-rata-by-value">Pro-rata by Value</SelectItem>
                          <SelectItem value="pro-rata-by-contribution-share">Pro-rata by Contribution Share</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {rule.basis === 'fixed-annual' ? (
                      <CurrencyInput
                        label={`Base Amount (${policy.currency})`}
                        value={rule.amount}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, amount: value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    ) : (
                      <PercentInput
                        label="Rate"
                        value={rule.rate}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, rate: value }
                          updateChargeRules(nextRules)
                        }}
                      />
                    )}

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Start Year Gate</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.startPolicyYear != null}
                          onChange={(event) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              startPolicyYear: event.target.checked ? (rule.startPolicyYear ?? 1) : undefined,
                            }
                            updateChargeRules(nextRules)
                          }}
                        />
                        Only start charging from a specific policy year
                      </label>
                    </div>

                    {rule.startPolicyYear != null && (
                      <NumberInput
                        label="Start Policy Year"
                        value={rule.startPolicyYear}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, startPolicyYear: value }
                          updateChargeRules(nextRules)
                        }}
                        integer
                        min={1}
                      />
                    )}

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Open-ended</Label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.endPolicyYear == null}
                          onChange={(event) => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              endPolicyYear: event.target.checked ? null : (rule.startPolicyYear ?? 1),
                            }
                            updateChargeRules(nextRules)
                          }}
                        />
                        No end year
                      </label>
                    </div>

                    {rule.endPolicyYear != null && (
                      <NumberInput
                        label="End Policy Year"
                        value={rule.endPolicyYear}
                        onChange={(value) => {
                          const nextRules = [...(policy.chargeRules ?? [])]
                          nextRules[index] = { ...rule, endPolicyYear: value }
                          updateChargeRules(nextRules)
                        }}
                        integer
                        min={rule.startPolicyYear ?? 1}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Applies To Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.appliesTo.includes(account.id)}
                            onChange={(event) => {
                              const nextRules = [...(policy.chargeRules ?? [])]
                              nextRules[index] = {
                                ...rule,
                                appliesTo: event.target.checked
                                  ? [...rule.appliesTo, account.id]
                                  : rule.appliesTo.filter((accountId) => accountId !== account.id),
                              }
                              updateChargeRules(nextRules)
                            }}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Fallback Deduction Accounts</Label>
                    <div className="flex flex-wrap gap-3">
                      {policy.accounts.map((account) => (
                        <label key={account.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={rule.fallbackAppliesTo?.includes(account.id) ?? false}
                            onChange={(event) => {
                              const nextRules = [...(policy.chargeRules ?? [])]
                              const nextFallback = event.target.checked
                                ? [...(rule.fallbackAppliesTo ?? []), account.id]
                                : (rule.fallbackAppliesTo ?? []).filter((accountId) => accountId !== account.id)
                              nextRules[index] = {
                                ...rule,
                                fallbackAppliesTo: nextFallback,
                              }
                              updateChargeRules(nextRules)
                            }}
                          />
                          {account.label}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      When the primary deduction accounts are exhausted, the remaining fixed annual charge can fall through to these accounts.
                    </p>
                  </div>

                  {rule.basis === 'fixed-annual' && (
                    <div className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Amount Schedule</h4>
                          <p className="text-sm text-muted-foreground">
                            Optional year-specific fixed amounts. Outside these tiers, the base amount above is used.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.chargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              amountSchedule: [
                                ...(rule.amountSchedule ?? []),
                                {
                                  startPolicyYear: rule.startPolicyYear ?? 1,
                                  endPolicyYear: null,
                                  amount: rule.amount,
                                },
                              ],
                            }
                            updateChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Tier
                        </Button>
                      </div>

                      {(rule.amountSchedule?.length ?? 0) === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No year-specific amount tiers configured.
                        </p>
                      ) : rule.amountSchedule?.map((tier, tierIndex) => (
                        <Card key={`${rule.id}-tier-${tierIndex}`}>
                          <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                            <NumberInput
                              label="Tier Start Year"
                              value={tier.startPolicyYear}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.amountSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                              integer
                              min={1}
                            />

                            <div className="space-y-3">
                              <Label className="text-sm font-medium">Open-ended Tier</Label>
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={tier.endPolicyYear == null}
                                  onChange={(event) => {
                                    const nextRules = [...(policy.chargeRules ?? [])]
                                    const nextSchedule = [...(rule.amountSchedule ?? [])]
                                    nextSchedule[tierIndex] = {
                                      ...tier,
                                      endPolicyYear: event.target.checked ? null : tier.startPolicyYear,
                                    }
                                    nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                    updateChargeRules(nextRules)
                                  }}
                                />
                                No end year
                              </label>
                            </div>

                            {tier.endPolicyYear != null && (
                              <NumberInput
                                label="Tier End Year"
                                value={tier.endPolicyYear}
                                onChange={(value) => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  const nextSchedule = [...(rule.amountSchedule ?? [])]
                                  nextSchedule[tierIndex] = { ...tier, endPolicyYear: value }
                                  nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                  updateChargeRules(nextRules)
                                }}
                                integer
                                min={tier.startPolicyYear}
                              />
                            )}

                            <CurrencyInput
                              label={`Tier Amount (${policy.currency})`}
                              value={tier.amount}
                              onChange={(value) => {
                                const nextRules = [...(policy.chargeRules ?? [])]
                                const nextSchedule = [...(rule.amountSchedule ?? [])]
                                nextSchedule[tierIndex] = { ...tier, amount: value }
                                nextRules[index] = { ...rule, amountSchedule: nextSchedule }
                                updateChargeRules(nextRules)
                              }}
                            />

                            <div className="flex items-end justify-end">
                              <Button
                                variant="outline"
                                className="text-destructive"
                                type="button"
                                onClick={() => {
                                  const nextRules = [...(policy.chargeRules ?? [])]
                                  nextRules[index] = {
                                    ...rule,
                                    amountSchedule: (rule.amountSchedule ?? []).filter((_, candidateIndex) => candidateIndex !== tierIndex),
                                  }
                                  updateChargeRules(nextRules)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove Tier
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      className="text-destructive"
                      type="button"
                      onClick={() => updateChargeRules((policy.chargeRules ?? []).filter((_, chargeIndex) => chargeIndex !== index))}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Charge Rule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="events">
          <AccordionTrigger>Policy Events & Event Charges</AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Policy Events</h3>
                  <p className="text-sm text-muted-foreground">
                    Use policy-month timing for premium holidays, withdrawals, and premium reductions that affect contribution flow, event charges, or bonus eligibility.
                  </p>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => updatePolicyEvents([
                    ...(policy.policyEvents ?? []),
                    {
                      id: createDraftId('event'),
                      type: 'premium-holiday',
                      startPolicyMonth: policy.monthsAlreadyPaid + 1,
                      durationMonths: 1,
                    },
                  ])}
                >
                  <Plus className="h-4 w-4" />
                  Add Event
                </Button>
              </div>

              {(policy.policyEvents ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No policy events configured.
                  </CardContent>
                </Card>
              ) : (policy.policyEvents ?? []).map((event, index) => (
                <Card key={event.id}>
                  <CardContent className="grid gap-4 pt-6 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label>Event Type</Label>
                      <Select
                      value={event.type}
                      onValueChange={(value) => {
                        const nextEvents = [...(policy.policyEvents ?? [])]
                        nextEvents[index] = {
                          ...event,
                          type: value as IlpPolicyEvent['type'],
                          amount: value === 'partial-withdrawal'
                            ? (event.amount ?? 1_000)
                            : (value === 'regular-premium-reduction' ? (event.amount ?? 1_200) : (value === 'top-up' ? (event.amount ?? 1_000) : undefined)),
                          accountId: value === 'partial-withdrawal'
                            ? (event.accountId ?? policy.accounts[0]?.id)
                            : (value === 'top-up' ? event.accountId : undefined),
                          repayMissedPremiums: value === 'premium-holiday' ? (event.repayMissedPremiums ?? false) : undefined,
                          repaymentAccountId: value === 'premium-holiday' ? event.repaymentAccountId : undefined,
                        }
                        updatePolicyEvents(nextEvents)
                      }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="premium-holiday">Premium Holiday</SelectItem>
                          <SelectItem value="partial-withdrawal">Partial Withdrawal</SelectItem>
                          <SelectItem value="regular-premium-reduction">Regular Premium Reduction</SelectItem>
                          <SelectItem value="top-up">Top-up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <NumberInput
                      label="Start Policy Month"
                      value={event.startPolicyMonth}
                      onChange={(value) => {
                        const nextEvents = [...(policy.policyEvents ?? [])]
                        nextEvents[index] = { ...event, startPolicyMonth: value }
                        updatePolicyEvents(nextEvents)
                      }}
                      integer
                      min={1}
                    />

                    <NumberInput
                      label="Duration (months)"
                      value={event.durationMonths}
                      onChange={(value) => {
                        const nextEvents = [...(policy.policyEvents ?? [])]
                        nextEvents[index] = { ...event, durationMonths: value }
                        updatePolicyEvents(nextEvents)
                      }}
                      integer
                      min={1}
                    />

                    {event.type === 'partial-withdrawal' ? (
                      <>
                        <CurrencyInput
                          label={`Withdrawal Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Source Account</Label>
                          <Select
                            value={event.accountId ?? policy.accounts[0]?.id ?? ''}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, accountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : event.type === 'premium-holiday' ? (
                      <>
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Repay Missed Premiums</Label>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={event.repayMissedPremiums ?? false}
                              onChange={(inputEvent) => {
                                const nextEvents = [...(policy.policyEvents ?? [])]
                                nextEvents[index] = {
                                  ...event,
                                  repayMissedPremiums: inputEvent.target.checked,
                                  repaymentAccountId: inputEvent.target.checked
                                    ? (event.repaymentAccountId ?? policy.accounts.find((account) => account.id === 'aua')?.id ?? policy.accounts[0]?.id)
                                    : undefined,
                                }
                                updatePolicyEvents(nextEvents)
                              }}
                            />
                            Full back-pay immediately after the latest holiday period
                          </label>
                        </div>
                        <div className="space-y-1">
                          <Label>Repayment Account</Label>
                          <Select
                            value={event.repaymentAccountId ?? policy.accounts.find((account) => account.id === 'aua')?.id ?? policy.accounts[0]?.id ?? ''}
                            disabled={!(event.repayMissedPremiums ?? false)}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = { ...event, repaymentAccountId: value }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    ) : event.type === 'regular-premium-reduction' ? (
                      <CurrencyInput
                        label={`Annual Reduction Amount (${policy.currency})`}
                        value={event.amount ?? 0}
                        onChange={(value) => {
                          const nextEvents = [...(policy.policyEvents ?? [])]
                          nextEvents[index] = { ...event, amount: value }
                          updatePolicyEvents(nextEvents)
                        }}
                      />
                    ) : event.type === 'top-up' ? (
                      <>
                        <CurrencyInput
                          label={`Top-up Amount (${policy.currency})`}
                          value={event.amount ?? 0}
                          onChange={(value) => {
                            const nextEvents = [...(policy.policyEvents ?? [])]
                            nextEvents[index] = { ...event, amount: value }
                            updatePolicyEvents(nextEvents)
                          }}
                        />
                        <div className="space-y-1">
                          <Label>Target Account</Label>
                          <Select
                            value={event.accountId ?? USE_TOP_UP_ROUTING_VALUE}
                            onValueChange={(value) => {
                              const nextEvents = [...(policy.policyEvents ?? [])]
                              nextEvents[index] = {
                                ...event,
                                accountId: value === USE_TOP_UP_ROUTING_VALUE ? undefined : value,
                              }
                              updatePolicyEvents(nextEvents)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={USE_TOP_UP_ROUTING_VALUE}>Use top-up routing rules</SelectItem>
                              {policy.accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Leave this on routing rules to follow any seeded top-up account split from the catalog template.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-end justify-end">
                        <Button
                          variant="outline"
                          className="text-destructive"
                          type="button"
                          onClick={() => updatePolicyEvents((policy.policyEvents ?? []).filter((_, eventIndex) => eventIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Event
                        </Button>
                      </div>
                    )}

                    {(event.type === 'partial-withdrawal' || event.type === 'regular-premium-reduction' || event.type === 'top-up') && (
                      <div className="flex items-end justify-end xl:col-span-4">
                        <Button
                          variant="outline"
                          className="text-destructive"
                          type="button"
                          onClick={() => updatePolicyEvents((policy.policyEvents ?? []).filter((_, eventIndex) => eventIndex !== index))}
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove Event
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Event Charge Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Model one-time charges that fire when a partial withdrawal happens, such as withdrawal or bonus recovery charges.
                  </p>
                </div>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => updateEventChargeRules([
                    ...(policy.eventChargeRules ?? []),
                    {
                      id: createDraftId('event-charge'),
                      label: `Event Charge ${(policy.eventChargeRules?.length ?? 0) + 1}`,
                      trigger: 'partial-withdrawal',
                      basis: 'event-amount',
                      appliesTo: policy.accounts.map((account) => account.id),
                      rate: 0,
                      rateSchedule: [],
                      amount: 0,
                      allocation: 'equal-split',
                    },
                  ])}
                >
                  <Plus className="h-4 w-4" />
                  Add Event Charge
                </Button>
              </div>

              {(policy.eventChargeRules ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-sm text-muted-foreground">
                    No event charge rules configured.
                  </CardContent>
                </Card>
              ) : (policy.eventChargeRules ?? []).map((rule, index) => (
                <Card key={rule.id}>
                  <CardContent className="space-y-4 pt-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Label</Label>
                        <Input
                          className="border-blue-300"
                          value={rule.label}
                          onChange={(event) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, label: event.target.value }
                            updateEventChargeRules(nextRules)
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Basis</Label>
                        <Select
                          value={rule.basis}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, basis: value as IlpEventChargeRule['basis'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="premium-reduction-with-startup-recovery">Premium Reduction Recovery</SelectItem>
                            <SelectItem value="repaid-premium-with-missed-months">Repaid Premium with Missed Months</SelectItem>
                            <SelectItem value="annual-premium-with-overlap-months">Annual Premium During Holiday</SelectItem>
                            <SelectItem value="premium-holiday-charge-refund">Premium Holiday Charge Refund</SelectItem>
                            <SelectItem value="event-amount">Event Amount</SelectItem>
                            <SelectItem value="account-value">Account Value</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label>Trigger</Label>
                        <Select
                          value={rule.trigger}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, trigger: value as IlpEventChargeRule['trigger'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="partial-withdrawal">Partial Withdrawal</SelectItem>
                            <SelectItem value="regular-premium-reduction">Regular Premium Reduction</SelectItem>
                            <SelectItem value="premium-holiday">Premium Holiday</SelectItem>
                            <SelectItem value="premium-holiday-repayment">Premium Holiday Repayment</SelectItem>
                            <SelectItem value="top-up">Top-up</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <PercentInput
                        label="Rate"
                        value={rule.rate}
                        onChange={(value) => {
                          const nextRules = [...(policy.eventChargeRules ?? [])]
                          nextRules[index] = { ...rule, rate: value }
                          updateEventChargeRules(nextRules)
                        }}
                      />

                      <CurrencyInput
                        label={`Fixed Charge (${policy.currency})`}
                        value={rule.amount}
                        onChange={(value) => {
                          const nextRules = [...(policy.eventChargeRules ?? [])]
                          nextRules[index] = { ...rule, amount: value }
                          updateEventChargeRules(nextRules)
                        }}
                      />

                      {rule.basis === 'premium-holiday-charge-refund' && (
                        <div className="space-y-1">
                          <Label>Refund Source Rule</Label>
                          <Select
                            value={rule.sourceChargeRuleId ?? ''}
                            onValueChange={(value) => {
                              const nextRules = [...(policy.eventChargeRules ?? [])]
                              nextRules[index] = { ...rule, sourceChargeRuleId: value }
                              updateEventChargeRules(nextRules)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a premium holiday charge rule" />
                            </SelectTrigger>
                            <SelectContent>
                              {(policy.eventChargeRules ?? [])
                                .filter((candidate) => candidate.id !== rule.id && candidate.trigger === 'premium-holiday')
                                .map((candidate) => (
                                  <SelectItem key={candidate.id} value={candidate.id}>{candidate.label}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label>Allocation</Label>
                        <Select
                          value={rule.allocation}
                          onValueChange={(value) => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = { ...rule, allocation: value as IlpEventChargeRule['allocation'] }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equal-split">Equal Split</SelectItem>
                            <SelectItem value="pro-rata-by-value">Pro-rata by Value</SelectItem>
                            <SelectItem value="pro-rata-by-contribution-share">Pro-rata by Contribution Share</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Rate Schedule</Label>
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            const nextRules = [...(policy.eventChargeRules ?? [])]
                            nextRules[index] = {
                              ...rule,
                              rateSchedule: [
                                ...(rule.rateSchedule ?? []),
                                {
                                  startPolicyYear: 1,
                                  endPolicyYear: null,
                                  rate: rule.rate,
                                },
                              ],
                            }
                            updateEventChargeRules(nextRules)
                          }}
                        >
                          <Plus className="h-4 w-4" />
                          Add Rate Tier
                        </Button>
                      </div>

                      {(rule.rateSchedule ?? []).length > 0 && (
                        <div className="space-y-3">
                          {(rule.rateSchedule ?? []).map((tier, tierIndex) => (
                            <Card key={`${rule.id}-tier-${tierIndex}`}>
                              <CardContent className="grid gap-4 pt-6 md:grid-cols-4">
                                <NumberInput
                                  label="Start Policy Year"
                                  value={tier.startPolicyYear}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, startPolicyYear: value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                  integer
                                  min={1}
                                />
                                <NumberInput
                                  label="End Policy Year"
                                  value={tier.endPolicyYear ?? 0}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, endPolicyYear: value <= 0 ? null : value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                  integer
                                  min={0}
                                />
                                <PercentInput
                                  label="Tier Rate"
                                  value={tier.rate}
                                  onChange={(value) => {
                                    const nextRules = [...(policy.eventChargeRules ?? [])]
                                    const nextSchedule = [...(rule.rateSchedule ?? [])]
                                    nextSchedule[tierIndex] = { ...tier, rate: value }
                                    nextRules[index] = { ...rule, rateSchedule: nextSchedule }
                                    updateEventChargeRules(nextRules)
                                  }}
                                />
                                <div className="flex items-end justify-end">
                                  <Button
                                    variant="outline"
                                    className="text-destructive"
                                    type="button"
                                    onClick={() => {
                                      const nextRules = [...(policy.eventChargeRules ?? [])]
                                      nextRules[index] = {
                                        ...rule,
                                        rateSchedule: (rule.rateSchedule ?? []).filter((_, scheduleIndex) => scheduleIndex !== tierIndex),
                                      }
                                      updateEventChargeRules(nextRules)
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove Tier
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Apply Charge To</Label>
                      <div className="flex flex-wrap gap-3">
                        {policy.accounts.map((account) => (
                          <label key={account.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={rule.appliesTo.includes(account.id)}
                              onChange={(event) => {
                                const nextRules = [...(policy.eventChargeRules ?? [])]
                                nextRules[index] = {
                                  ...rule,
                                  appliesTo: event.target.checked
                                    ? [...rule.appliesTo, account.id]
                                    : rule.appliesTo.filter((accountId) => accountId !== account.id),
                                }
                                updateEventChargeRules(nextRules)
                              }}
                            />
                            {account.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        className="text-destructive"
                        type="button"
                        onClick={() => updateEventChargeRules((policy.eventChargeRules ?? []).filter((_, ruleIndex) => ruleIndex !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove Event Charge
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="settings">
          <AccordionTrigger>Analysis Settings</AccordionTrigger>
          <AccordionContent className="grid gap-4 md:grid-cols-3">
            <PercentInput
              label="Discount Rate"
              value={policy.discountRate}
              onChange={(value) => updatePolicy(policy.id, { discountRate: value })}
            />
            <PercentInput
              label="Inflation Rate"
              value={policy.inflationRate}
              onChange={(value) => updatePolicy(policy.id, { inflationRate: value })}
            />
            <PercentInput
              label="Alternative Return"
              value={policy.alternativeReturn}
              onChange={(value) => updatePolicy(policy.id, { alternativeReturn: value })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
