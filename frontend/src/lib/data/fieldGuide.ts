import type { SectionId } from '@/lib/household/sectionOrder'

interface SectionGuide {
  sectionId: SectionId
  coldIntro: string
  contextTemplate: string // includes {placeholders} filled at render time
}

export const SECTION_GUIDES: SectionGuide[] = [
  {
    sectionId: 'section-cpf',
    coldIntro:
      'Configure your CPF accounts, contribution projections, and retirement payouts. Have your CPF statement handy from my.cpf.gov.sg → My Statement.',
    contextTemplate:
      'You entered {cpfSummary} during setup. This section lets you fine-tune top-ups, CPFIS, LIFE plan, OA withdrawals, and drawdown timing.',
  },
  {
    sectionId: 'section-income',
    coldIntro:
      'Set up your salary, bonus, and additional income streams. Choose between simple flat growth, realistic career phases, or MOM benchmark-driven projections.',
    contextTemplate:
      'You entered ${annualIncome}/year during setup. This section lets you add income streams, set growth models, and configure bonuses.',
  },
  {
    sectionId: 'section-expenses',
    coldIntro:
      'Enter your annual expenses and any future spending goals. Break down by category for more accurate retirement spending estimates.',
    contextTemplate:
      'You entered ${annualExpenses}/year during setup. Break down by category here for more accurate retirement projections.',
  },
  {
    sectionId: 'section-property',
    coldIntro:
      'Add property details including current value, mortgage, and downsizing plans. Property equity can significantly affect your FIRE timeline.',
    contextTemplate:
      'You entered a {propertyType} valued at ${propertyValue} during setup. This section lets you add mortgage details, downsizing plans, and rental income.',
  },
  {
    sectionId: 'section-healthcare',
    coldIntro:
      'Configure healthcare costs including MediShield Life, Integrated Shield Plans, MediSave, and CareShield Life premiums.',
    contextTemplate:
      'You selected {ispTier} ISP tier during setup. This section lets you fine-tune premiums, MediSave top-ups, and out-of-pocket estimates.',
  },
  {
    sectionId: 'section-protection',
    coldIntro:
      'Add emergency fund, debts, and insurance coverage to assess your financial safety net.',
    contextTemplate:
      'This section lets you detail your emergency fund, outstanding debts, and life/CI/disability insurance coverage.',
  },
  {
    sectionId: 'section-net-worth',
    coldIntro:
      'Enter your liquid net worth (savings, investments, fixed deposits). Exclude CPF and property equity which are tracked separately.',
    contextTemplate:
      'You entered ${liquidNetWorth} liquid net worth during setup. Add locked assets, additional accounts, or adjust here.',
  },
  {
    sectionId: 'section-allocation',
    coldIntro:
      'Choose your investment allocation across 8 asset classes. Pick a template (Conservative, Balanced, Aggressive) or customize weights.',
    contextTemplate:
      'Using {allocationTemplate} template. Adjust weights across 8 asset classes or enable a glide path for age-based shifting.',
  },
  {
    sectionId: 'section-personal',
    coldIntro:
      'Core demographics: age, retirement age, life expectancy, residency status, and marital status.',
    contextTemplate:
      'Age {currentAge}, targeting retirement at {retirementAge}. Adjust life expectancy, residency, or other demographics here.',
  },
]

export function getSectionGuide(sectionId: SectionId): SectionGuide | undefined {
  return SECTION_GUIDES.find((g) => g.sectionId === sectionId)
}
