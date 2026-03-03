import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { useProfileStore } from '@/stores/useProfileStore'
import { calculateBrsFrsErs } from '@/lib/calculations/cpf'
import { getCpfRatesForAge } from '@/lib/data/cpfRates'
import {
  RETIREMENT_SUM_BASE_YEAR,
  BRS_BASE,
  FRS_BASE,
  ERS_BASE,
  BRS_GROWTH_RATE,
  OA_INTEREST_RATE,
  SA_INTEREST_RATE,
  MA_INTEREST_RATE,
  RA_INTEREST_RATE,
  EXTRA_INTEREST_RATE,
  EXTRA_INTEREST_COMBINED_CAP,
  EXTRA_INTEREST_OA_CAP,
  EXTRA_INTEREST_OA_CAP_55_PLUS,
  EXTRA_INTEREST_RA_ADDITIONAL,
  OW_CEILING_MONTHLY,
  AW_CEILING_TOTAL,
} from '@/lib/data/cpfRates'
import { formatCurrency, formatPercent } from '@/lib/utils'

const CPF_SOURCES = {
  retirementSums: 'https://www.cpf.gov.sg/service/article/what-are-the-retirement-sums-basic-retirement-sum-brs-full-retirement-sum-frs-and-enhanced-retirement-sum-ers',
  contributionRates: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
  interestRates: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
}

export function CpfAssumptionsPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const currentAge = useProfileStore((s) => s.currentAge)
  const residencyStatus = useProfileStore((s) => s.residencyStatus)
  const prMonths = useProfileStore((s) => s.prMonths)
  const cpfLifeStartAge = useProfileStore((s) => s.cpfLifeStartAge)
  const cpfLifePlan = useProfileStore((s) => s.cpfLifePlan)

  const rates = getCpfRatesForAge(currentAge, residencyStatus, prMonths)
  const brsFrsErs = calculateBrsFrsErs(currentAge)

  const planLabels: Record<string, string> = {
    basic: 'Basic (~5.4%)',
    standard: 'Standard (~6.3%)',
    escalating: 'Escalating (~4.8%, +2%/yr)',
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        CPF Assumptions &amp; Rates
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-muted/30 border rounded-md text-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Column 1: Retirement Sums */}
            <div className="space-y-1">
              <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Retirement Sums</h5>
              <div className="space-y-0.5">
                <div>Base year: {RETIREMENT_SUM_BASE_YEAR}</div>
                <div>BRS: {formatCurrency(BRS_BASE)}</div>
                <div>FRS: {formatCurrency(FRS_BASE)}</div>
                <div>ERS: {formatCurrency(ERS_BASE)}</div>
                <div>Growth: {formatPercent(BRS_GROWTH_RATE)} p.a.</div>
                <div className="pt-1 font-medium">
                  Your FRS at 55: {formatCurrency(brsFrsErs.frs)}
                </div>
              </div>
            </div>

            {/* Column 2: Interest Rates */}
            <div className="space-y-1">
              <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">Interest Rates</h5>
              <div className="space-y-0.5">
                <div>OA: {formatPercent(OA_INTEREST_RATE)}</div>
                <div>SA/RA: {formatPercent(SA_INTEREST_RATE)}</div>
                <div>MA: {formatPercent(MA_INTEREST_RATE)}</div>
                <div>Extra: +{formatPercent(EXTRA_INTEREST_RATE)} on first {formatCurrency(EXTRA_INTEREST_COMBINED_CAP)}</div>
                <div className="text-xs text-muted-foreground pl-2">
                  (max {formatCurrency(EXTRA_INTEREST_OA_CAP)} from OA; {formatCurrency(EXTRA_INTEREST_OA_CAP_55_PLUS)} if 55+)
                </div>
                <div>55+: +{formatPercent(EXTRA_INTEREST_RA_ADDITIONAL)} extra on first $30K RA</div>
              </div>
            </div>

            {/* Column 3: Contribution Rates */}
            <div className="space-y-1">
              <h5 className="font-medium text-xs text-muted-foreground uppercase tracking-wider">
                Contribution Rates (Age {currentAge}, {rates.ageGroup})
              </h5>
              <div className="space-y-0.5">
                <div>Employee: {formatPercent(rates.employeeRate)}</div>
                <div>Employer: {formatPercent(rates.employerRate)}</div>
                <div>Total: {formatPercent(rates.totalRate)}</div>
                <div>OW ceiling: {formatCurrency(OW_CEILING_MONTHLY)}/mo</div>
                <div>AW ceiling: {formatCurrency(AW_CEILING_TOTAL)}</div>
              </div>
            </div>
          </div>

          {/* CPF LIFE row */}
          <div className="pt-1 border-t text-xs text-muted-foreground">
            CPF LIFE: {planLabels[cpfLifePlan]} from age {cpfLifeStartAge} &middot; RA earns {formatPercent(RA_INTEREST_RATE)} until payout starts
          </div>

          {/* Interest methodology note */}
          <div className="text-xs text-muted-foreground">
            Interest method: Mid-year approximation — contributions and withdrawals are treated as spread evenly through the year.
          </div>

          {/* Source links */}
          <div className="pt-1 border-t text-xs text-muted-foreground flex flex-wrap gap-3">
            <span>Sources:</span>
            <a href={CPF_SOURCES.retirementSums} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
              Retirement Sums <ExternalLink className="w-3 h-3" />
            </a>
            <a href={CPF_SOURCES.contributionRates} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
              Contribution Rates <ExternalLink className="w-3 h-3" />
            </a>
            <a href={CPF_SOURCES.interestRates} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 hover:text-foreground">
              Interest Rates <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
