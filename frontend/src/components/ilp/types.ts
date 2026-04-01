export type ReturnWindowSlug =
  | '3_month'
  | '6_month'
  | '1_year'
  | '3_year'
  | '5_year'
  | '10_year'
  | 'since_inception'

export type ReturnStats = {
  label?: string
  fundDisplay?: string
  fundPct?: number | null
  benchmarkDisplay?: string
  benchmarkPct?: number | null
  gapDisplay?: string
  gapPct?: number | null
  hasData?: boolean
}

export type IlpMasterRow = {
  id: string
  insurer: string
  subFund: string
  benchmark?: string
  etfProxy?: string
  etfProxyConfidence?: string
  annualFeeLabel?: string
  annualFeeDisplay?: string
  annualFeePct?: number | null
  feeMetric?: string
  feeAsOfDate?: string
  feeVerificationStatus?: string
  feeSource?: {
    url?: string
    page?: string
    locator?: string
    note?: string
  }
  lookthrough?: {
    structureType?: string
    underlyingFund?: string
    externalManager?: string
    officialSourceUrl?: string
    sourceEvidence?: string
  }
  returns?: {
    hasComparisonData?: boolean
    fundFamily?: string
    groupingKey?: string
    shareClassOrCurrency?: string
    inceptionDate?: string
    inceptionDateIso?: string | null
    asOfDate?: string
    comparisonQuality?: string
    comparisonNote?: string
    returnSourceUrl?: string
    returnSourcePage?: string
    availableWindowCount?: number
    windowCount?: number
    windows?: Partial<Record<string, ReturnStats>>
  }
  notes?: string
  source?: string
}

export type IlpMasterData = {
  coverage: {
    rowCount: number
    returnComparisonRows?: number
    feeVerifiedRows?: number
  }
  rows: IlpMasterRow[]
}

export const RETURN_WINDOWS: Array<{ slug: ReturnWindowSlug; label: string }> = [
  { slug: '3_month', label: '3-month' },
  { slug: '6_month', label: '6-month' },
  { slug: '1_year', label: '1-year' },
  { slug: '3_year', label: '3-year' },
  { slug: '5_year', label: '5-year' },
  { slug: '10_year', label: '10-year' },
  { slug: 'since_inception', label: 'Since inception' },
]
