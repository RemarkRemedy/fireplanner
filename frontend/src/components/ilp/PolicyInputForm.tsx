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
import { computeBlendedReturn, type IlpPolicyInput } from '@/lib/calculations/ilp'
import { EEC_PRESETS } from '@/lib/data/ilpDefaults'
import { useIlpStore } from '@/stores/useIlpStore'
import { cn } from '@/lib/utils'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatIlpPercent } from './formatters'

interface PolicyInputFormProps {
  policy: IlpPolicyInput | null
  issues: string[]
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
  const eecChartData = policy.eecTable.map((rate, index) => ({ year: index + 1, rate: rate * 100 }))

  return (
    <div className="space-y-4">
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

      <Accordion type="multiple" defaultValue={['policy', 'accounts', 'eec', 'funds', 'bonuses', 'settings']} className="rounded-lg border bg-card px-4">
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
