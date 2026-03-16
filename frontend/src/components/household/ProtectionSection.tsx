import { useHouseholdPlanStore } from '@/stores/useHouseholdPlanStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CurrencyInput } from '@/components/shared/CurrencyInput'
import { NumberInput } from '@/components/shared/NumberInput'

export function ProtectionSection() {
  const plan = useHouseholdPlanStore((s) => s.plan)
  const updateAdult = useHouseholdPlanStore((s) => s.updateAdult)

  const adults = plan.adults

  return (
    <>
      {adults.map((adult) => (
        <Card key={adult.id} id={`protection-${adult.id}`}>
          <CardHeader>
            <CardTitle className="text-base">
              {adults.length > 1 ? `${adult.displayName} — Protection` : 'Protection & Insurance'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Cash & Debt */}
            <div>
              <h4 className="text-sm font-medium mb-3">Cash & Debt</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Cash Savings"
                  tooltip="Portion of liquid net worth held in cash or cash-equivalents (savings accounts, fixed deposits). This is a subset of your liquid net worth."
                  value={adult.cashSavings}
                  onChange={(v) => updateAdult(adult.id, { cashSavings: v })}
                />
                <CurrencyInput
                  label="Non-Mortgage Debt (Total)"
                  tooltip="Total outstanding balance of non-mortgage debts: car loans, renovation loans, credit card balances, personal loans, etc."
                  value={adult.nonMortgageDebtTotal}
                  onChange={(v) => updateAdult(adult.id, { nonMortgageDebtTotal: v })}
                />
                <CurrencyInput
                  label="Non-Mortgage Debt (Monthly Payment)"
                  tooltip="Combined monthly repayment for all non-mortgage debts."
                  value={adult.nonMortgageDebtMonthlyPayment}
                  onChange={(v) => updateAdult(adult.id, { nonMortgageDebtMonthlyPayment: v })}
                />
                <NumberInput
                  label="Emergency Fund Target (months)"
                  tooltip="Target emergency fund size in months of expenses. Used by the financial health check to assess adequacy."
                  value={adult.emergencyFundTarget ?? 6}
                  onChange={(v) => updateAdult(adult.id, { emergencyFundTarget: Math.round(v) })}
                  min={0}
                  max={24}
                  step={1}
                />
              </div>
            </div>

            {/* Insurance Coverage */}
            <div>
              <h4 className="text-sm font-medium mb-3">Existing Insurance Coverage</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Death / TPD Coverage"
                  tooltip="Total sum assured from all life insurance and TPD (Total Permanent Disability) policies."
                  value={adult.insuranceDeathCoverage}
                  onChange={(v) => updateAdult(adult.id, { insuranceDeathCoverage: v })}
                />
                <CurrencyInput
                  label="Critical Illness Coverage"
                  tooltip="Total sum assured from all critical illness policies."
                  value={adult.insuranceCICoverage}
                  onChange={(v) => updateAdult(adult.id, { insuranceCICoverage: v })}
                />
                <CurrencyInput
                  label="Disability Income (Monthly)"
                  tooltip="Monthly payout from disability income insurance if you cannot work."
                  value={adult.insuranceDisabilityMonthly}
                  onChange={(v) => updateAdult(adult.id, { insuranceDisabilityMonthly: v })}
                />
                <CurrencyInput
                  label="Annual Insurance Premiums"
                  tooltip="Total annual premiums for all insurance policies (life, CI, disability). Deducted from cash flow in the projection."
                  value={adult.annualInsurancePremiums ?? 0}
                  onChange={(v) => updateAdult(adult.id, { annualInsurancePremiums: v })}
                />
              </div>
            </div>

            {/* Capital Needs Parameters */}
            <div>
              <h4 className="text-sm font-medium mb-3">Insurance Planning Parameters</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <CurrencyInput
                  label="Funeral Costs"
                  tooltip="Estimated funeral and final expenses. Singapore average is $10,000-$20,000."
                  value={adult.funeralCosts}
                  onChange={(v) => updateAdult(adult.id, { funeralCosts: v })}
                />
                <NumberInput
                  label="CI Recovery Years"
                  tooltip="Expected recovery period (in years) if diagnosed with a critical illness. Typically 3-5 years."
                  value={adult.ciRecoveryYears}
                  onChange={(v) => updateAdult(adult.id, { ciRecoveryYears: Math.round(v) })}
                  min={1}
                  max={10}
                  step={1}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
