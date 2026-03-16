import { type InsuranceNeedsResult } from '@/lib/calculations/insuranceNeeds'
import { type InsuranceNeedsInputs } from '@/lib/calculations/insuranceNeeds'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import { INSURANCE_MULTIPLES } from '@/lib/data/healthBenchmarks'
import { cn } from '@/lib/utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).format(v)

function GapCell({ gap }: { gap: number }) {
  return (
    <span className={cn('font-semibold', gap > 0 ? 'text-red-600' : 'text-emerald-600')}>
      {fmt(gap)}
    </span>
  )
}

function MoneySenseTab({ result, inputs }: { result: InsuranceNeedsResult; inputs: InsuranceNeedsInputs }) {
  const { deathTpd, criticalIllness, disabilityIncome } = result.moneySense

  const rows = [
    {
      label: 'Death / TPD',
      ...deathTpd,
      tooltip: `${INSURANCE_MULTIPLES.deathTpd}x annual income: ${fmt(inputs.annualIncome)} × ${INSURANCE_MULTIPLES.deathTpd} = ${fmt(deathTpd.need)}. MoneySense recommends coverage of ${INSURANCE_MULTIPLES.deathTpd} years of annual income.`,
    },
    {
      label: 'Critical Illness',
      ...criticalIllness,
      tooltip: `${INSURANCE_MULTIPLES.criticalIllness}x annual income: ${fmt(inputs.annualIncome)} × ${INSURANCE_MULTIPLES.criticalIllness} = ${fmt(criticalIllness.need)}. Covers income replacement during recovery period.`,
    },
    {
      label: 'Disability Income',
      need: disabilityIncome.need,
      existing: disabilityIncome.existing,
      gap: disabilityIncome.gap,
      note: `${fmt(disabilityIncome.needMonthly)}/mo needed, ${fmt(disabilityIncome.existingMonthly)}/mo covered`,
      tooltip: `${Math.round(INSURANCE_MULTIPLES.disabilityIncome * 100)}% of monthly income: ${fmt(inputs.monthlyIncome)} × ${Math.round(INSURANCE_MULTIPLES.disabilityIncome * 100)}% = ${fmt(disabilityIncome.needMonthly)}/mo. Industry range is 60-75% of salary; we use 65% as a conservative middle ground.`,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Estimate (MoneySense)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium text-right">Need</th>
                <th className="pb-2 font-medium text-right">Existing</th>
                <th className="pb-2 font-medium text-right">Gap</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="flex items-center gap-1">
                      {row.label}
                      <InfoTooltip text={row.tooltip} />
                    </div>
                    {'note' in row && row.note && (
                      <div className="text-xs text-muted-foreground mt-0.5">{row.note}</div>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmt(row.need)}</td>
                  <td className="py-2 text-right tabular-nums">{fmt(row.existing)}</td>
                  <td className="py-2 text-right tabular-nums">
                    <GapCell gap={row.gap} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CapitalNeedsTab({ result }: { result: InsuranceNeedsResult }) {
  const { deathTpd, criticalIllness, disabilityIncome } = result.capitalNeeds

  const obligations = [
    { label: 'Funeral Costs', value: deathTpd.funeralCosts },
    { label: 'Outstanding Debts', value: deathTpd.outstandingDebts },
    { label: 'Children Expenses (PV)', value: deathTpd.childrenExpenses },
    { label: 'Household Expenses (PV)', value: deathTpd.householdExpenses },
    { label: 'Parent Support (PV)', value: deathTpd.parentSupport },
    { label: 'Education Fund (PV)', value: deathTpd.educationFund },
  ]

  const resources = [
    { label: 'Existing Coverage', value: deathTpd.existingCoverage },
    { label: 'Liquid Assets', value: deathTpd.liquidAssets },
    { label: 'CPF Balances', value: deathTpd.cpfBalances },
  ]

  return (
    <div className="space-y-4">
      {/* Death/TPD Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Death / TPD</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Obligations */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Obligations</h4>
            <table className="w-full text-sm">
              <tbody>
                {obligations.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="py-1.5">{row.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(row.value)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pt-2">Total Needs</td>
                  <td className="py-1.5 pt-2 text-right tabular-nums">{fmt(deathTpd.totalNeeds)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Resources</h4>
            <table className="w-full text-sm">
              <tbody>
                {resources.map((row) => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="py-1.5">{row.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmt(row.value)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-1.5 pt-2">Total Resources</td>
                  <td className="py-1.5 pt-2 text-right tabular-nums">{fmt(deathTpd.totalResources)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Gap */}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-sm font-semibold">Insurance Gap</span>
            <GapCell gap={deathTpd.gap} />
          </div>
        </CardContent>
      </Card>

      {/* Critical Illness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Critical Illness</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1.5">
                  Need ({criticalIllness.recoveryYears}-year recovery)
                </td>
                <td className="py-1.5 text-right tabular-nums">{fmt(criticalIllness.need)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5">Existing Coverage</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(criticalIllness.existing)}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold">Gap</td>
                <td className="py-1.5 text-right">
                  <GapCell gap={criticalIllness.gap} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Disability Income */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Disability Income</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b">
                <td className="py-1.5">Monthly Need</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(disabilityIncome.needMonthly)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-1.5">Monthly Existing</td>
                <td className="py-1.5 text-right tabular-nums">{fmt(disabilityIncome.existingMonthly)}</td>
              </tr>
              <tr>
                <td className="py-1.5 font-semibold">Monthly Gap</td>
                <td className="py-1.5 text-right">
                  <GapCell gap={disabilityIncome.gapMonthly} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

export function InsuranceNeedsPanel({ result, inputs }: { result: InsuranceNeedsResult; inputs: InsuranceNeedsInputs }) {
  return (
    <Tabs defaultValue="moneysense">
      <TabsList>
        <TabsTrigger value="moneysense">Quick Estimate (MoneySense)</TabsTrigger>
        <TabsTrigger value="capital-needs">Capital Needs (Detailed)</TabsTrigger>
      </TabsList>
      <TabsContent value="moneysense" className="mt-4">
        <MoneySenseTab result={result} inputs={inputs} />
      </TabsContent>
      <TabsContent value="capital-needs" className="mt-4">
        <CapitalNeedsTab result={result} />
      </TabsContent>
    </Tabs>
  )
}
