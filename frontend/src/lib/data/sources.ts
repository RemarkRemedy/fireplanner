/**
 * Structured data source attributions.
 * Extracted from header comments in lib/data/ files.
 * Surfaced in the Help Panel and Reference Guide.
 */

export interface DataSource {
  name: string
  url: string
  period: string
  license: string
}

/** Sources grouped by the page/topic they're relevant to. */
export const DATA_SOURCES: Record<string, DataSource[]> = {
  cpf: [
    {
      name: 'CPF Contribution Rates',
      url: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
      period: '2026',
      license: 'Public data',
    },
  ],
  tax: [
    {
      name: 'SG Progressive Income Tax',
      url: 'https://www.iras.gov.sg/taxes/individual-income-tax/basics-of-individual-income-tax/tax-residency-and-tax-rates/individual-income-tax-rates',
      period: 'YA 2024+',
      license: 'Public data',
    },
  ],
  income: [
    {
      name: 'MOM Salary Benchmarks',
      url: 'https://stats.mom.gov.sg/Pages/Gross-Monthly-Income-Tables2025.aspx',
      period: '2025',
      license: 'SG Open Data License',
    },
  ],
  historicalReturns: [
    {
      name: 'US Equities (S&P 500)',
      url: 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html',
      period: '1928-2025',
      license: 'Academic/free',
    },
    {
      name: 'SG Equities (STI)',
      url: 'https://www.sgx.com',
      period: '1988-2025',
      license: 'SG Open Data License',
    },
    {
      name: 'Intl Equities (MSCI World)',
      url: 'https://www.msci.com',
      period: '1970-2025',
      license: 'Free for personal use, attribute MSCI',
    },
    {
      name: 'Bonds (10-yr Treasury)',
      url: 'https://fred.stlouisfed.org',
      period: '1928-2025',
      license: 'Public domain',
    },
    {
      name: 'REITs (FTSE NAREIT)',
      url: 'https://www.reit.com/data-research',
      period: '1972-2025',
      license: 'Free with attribution',
    },
    {
      name: 'Gold (LBMA)',
      url: 'https://www.gold.org',
      period: '1968-2025',
      license: 'Free non-commercial',
    },
    {
      name: 'Cash (3-month T-Bill)',
      url: 'https://fred.stlouisfed.org',
      period: '1928-2025',
      license: 'Public domain',
    },
    {
      name: 'CPF Interest Rates',
      url: 'https://www.cpf.gov.sg/member/cpf-overview',
      period: 'Published rates',
      license: 'Public',
    },
  ],
  property: [
    {
      name: "Bala's Table (SLA)",
      url: 'https://isomer-user-content.by.gov.sg/50/ade6cd16-890b-4a1b-9d1d-d0e189daba03/balas-table.pdf',
      period: '2017 (static)',
      license: 'Public data',
    },
    {
      name: 'BSD/ABSD Rates (IRAS)',
      url: 'https://www.iras.gov.sg/taxes/stamp-duty/for-property',
      period: '2023',
      license: 'Public data',
    },
  ],
  healthcare: [
    {
      name: 'MediShield Life Premiums',
      url: 'https://www.cpf.gov.sg/member/healthcare-financing/medishield-life/medishield-life-premiums-and-subsidies',
      period: '2025',
      license: 'Public data',
    },
  ],
  crisisScenarios: [
    {
      name: 'Crisis Scenarios',
      url: 'https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html',
      period: '1928-2025',
      license: 'Academic/free (Damodaran), Public domain (FRED)',
    },
  ],
}

/**
 * Map route paths AND section IDs to relevant source keys.
 * Section IDs take priority over route paths for /inputs sub-sections.
 */
export const ROUTE_SOURCES: Record<string, string[]> = {
  // Route-level
  '/inputs': ['cpf', 'tax', 'income', 'property'],
  '/projection': ['cpf', 'tax', 'income', 'historicalReturns'],
  '/stress-test': ['historicalReturns', 'crisisScenarios'],
  '/planner': ['historicalReturns', 'crisisScenarios'],
  '/dashboard': ['cpf', 'tax', 'historicalReturns'],
  // Section-level (for /inputs sub-sections)
  'section-personal': [],
  'section-fire-settings': [],
  'section-income': ['income', 'tax'],
  'section-expenses': [],
  'section-net-worth': [],
  'section-cpf': ['cpf'],
  'section-healthcare': ['healthcare'],
  'section-property': ['property'],
  'section-allocation': ['historicalReturns'],
}

/** Get all sources relevant to a given route or section ID. */
export function getSourcesForRoute(routeOrSection: string): DataSource[] {
  const keys = ROUTE_SOURCES[routeOrSection] ?? []
  const seen = new Set<string>()
  const result: DataSource[] = []
  for (const key of keys) {
    for (const src of DATA_SOURCES[key] ?? []) {
      if (!seen.has(src.url)) {
        seen.add(src.url)
        result.push(src)
      }
    }
  }
  return result
}
