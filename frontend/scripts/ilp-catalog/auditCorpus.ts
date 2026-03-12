import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { inferInsurer, inferProductName, isSummaryFile, MANUAL_CORPUS_DIR } from './discovery.js'
import { extractPdfText } from './pdf/extractPdfText.js'

const ROOT_DIR = path.resolve(import.meta.dirname, '../..')
const OUTPUT_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit')
const REPORT_PATH = path.join(ROOT_DIR, 'docs/ilp-catalog-corpus-audit.md')
const JSON_PATH = path.join(OUTPUT_DIR, 'corpus-audit.json')

type SupportBucket = 'A-core-fit' | 'B-extendable' | 'C-major-gap' | 'parser-error'

interface FeatureFlags {
  hasIua: boolean
  hasAua: boolean
  hasTopUpAccount: boolean
  hasGrowthAccount: boolean
  hasFlexAccount: boolean
  hasAdditionalInvestmentAccount: boolean
  hasRegularPremiumAccount: boolean
  hasInsuranceCharge: boolean
  hasAdminCharge: boolean
  hasPolicyCharge: boolean
  hasMultiLife: boolean
  hasDeathBenefitOptions: boolean
  hasCapitalGuarantee: boolean
  hasPremiumHoliday: boolean
  hasFreePartialWithdrawal: boolean
  hasPartialWithdrawalCharge: boolean
  hasBonusRecoveryCharge: boolean
  hasDividendOption: boolean
  hasRecurringSinglePremium: boolean
  hasTopUpPremium: boolean
  hasTieredBonus: boolean
  hasTieredFee: boolean
  hasNonGuaranteedCharge: boolean
  hasEec: boolean
}

interface AuditRecord {
  fileName: string
  insurer: string
  productName: string
  pageCount: number
  totalCharacters: number
  featureFlags: FeatureFlags
  accountModel: string
  bucket: SupportBucket
  gapTags: string[]
  notes: string[]
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

function countNamedAccounts(flags: FeatureFlags): number {
  return [
    flags.hasIua,
    flags.hasAua,
    flags.hasTopUpAccount,
    flags.hasGrowthAccount,
    flags.hasFlexAccount,
    flags.hasAdditionalInvestmentAccount,
    flags.hasRegularPremiumAccount,
  ].filter(Boolean).length
}

function inferAccountModel(flags: FeatureFlags): string {
  const names = []
  if (flags.hasIua) names.push('IUA')
  if (flags.hasAua) names.push('AUA')
  if (flags.hasTopUpAccount) names.push('Top-up Account')
  if (flags.hasGrowthAccount) names.push('Growth Account')
  if (flags.hasFlexAccount) names.push('Flex Account')
  if (flags.hasAdditionalInvestmentAccount) names.push('Additional Investment Account')
  if (flags.hasRegularPremiumAccount) names.push('Regular Premium Account')
  return names.length > 0 ? names.join(' + ') : 'Unclear'
}

function classify(text: string, fileName: string, pageCount: number, totalCharacters: number): AuditRecord {
  const normalized = text.toLowerCase()
  const featureFlags: FeatureFlags = {
    hasIua: has(normalized, /\binitial units account\b|\biua\b/),
    hasAua: has(normalized, /\baccumulation units account\b|\baua\b/),
    hasTopUpAccount: has(normalized, /\btop-up account\b|\btop up account\b|\btop-up units account\b|\btop up units account\b/),
    hasGrowthAccount: has(normalized, /\bgrowth account\b/),
    hasFlexAccount: has(normalized, /\bflex account\b/),
    hasAdditionalInvestmentAccount: has(normalized, /\badditional investment account\b/),
    hasRegularPremiumAccount: has(normalized, /\bregular premium account\b/),
    hasInsuranceCharge: has(normalized, /\binsurance charge\b|\bmortality charge\b|\bmonthly protection charge\b|\bprotection charge\b/),
    hasAdminCharge: has(normalized, /\badministration charge\b|\badmin charge\b/),
    hasPolicyCharge: has(normalized, /\bpolicy charge\b/),
    hasMultiLife: has(normalized, /\bmore than 1 person insured\b|\bmore than one person insured\b|\bmore than one \(1\) life assured\b|\blast person insured\b|\blast life assured\b|\bmultiple lives\b|\bjoint life\b/),
    hasDeathBenefitOptions: has(normalized, /\bbasic death benefit\b|\badvanced death benefit\b|\bdeath benefit option\b/),
    hasCapitalGuarantee: has(normalized, /\bcapital guarantee\b|\b100% of net premium\b|\bhigher of.*net premium\b/),
    hasPremiumHoliday: has(normalized, /\bpremium holiday\b/),
    hasFreePartialWithdrawal: has(normalized, /\bfree partial withdrawal\b/),
    hasPartialWithdrawalCharge: has(normalized, /\bpartial withdrawal charge\b|\bpwc\b/),
    hasBonusRecoveryCharge: has(normalized, /\bbonus recovery charge\b|\bbrc\b/),
    hasDividendOption: has(normalized, /\bdividend payout\b|\breinvest(ed)? dividends\b|\bcash payout\b/),
    hasRecurringSinglePremium: has(normalized, /\brecurring single premium\b|\brsp\b/),
    hasTopUpPremium: has(normalized, /\btop-up premium\b|\btop up premium\b/),
    hasTieredBonus: has(normalized, /\btier 1\b|\btier 2\b|\bpremium tier\b|\bbonus rate\b/),
    hasTieredFee: has(normalized, /\bfee rate table\b|\bcharge rate table\b|\bvar(y|ies) by policy year\b/),
    hasNonGuaranteedCharge: has(normalized, /\bnot guaranteed\b|\breserve the right to vary this charge\b|\bmay be varied from time to time\b/),
    hasEec: has(normalized, /\bearly encashment charge\b|\bearly exit charge\b|\beec\b|\bsurrender charge\b/),
  }

  const gapTags: string[] = []
  const notes: string[] = []
  const namedAccounts = countNamedAccounts(featureFlags)

  if (featureFlags.hasInsuranceCharge || featureFlags.hasAdminCharge || featureFlags.hasPolicyCharge) {
    gapTags.push('dynamic-charge-model')
  }
  if (featureFlags.hasMultiLife) {
    gapTags.push('multi-life')
  }
  if (featureFlags.hasDeathBenefitOptions || featureFlags.hasCapitalGuarantee) {
    gapTags.push('death-benefit-structure')
  }
  if (namedAccounts >= 3) {
    gapTags.push('three-plus-account-model')
  }
  if (featureFlags.hasPremiumHoliday) {
    gapTags.push('premium-holiday')
  }
  if (featureFlags.hasFreePartialWithdrawal) {
    gapTags.push('free-partial-withdrawal')
  }
  if (featureFlags.hasPartialWithdrawalCharge || featureFlags.hasBonusRecoveryCharge) {
    gapTags.push('withdrawal-reduction-charges')
  }
  if (featureFlags.hasDividendOption) {
    gapTags.push('dividend-mode')
  }
  if (featureFlags.hasRecurringSinglePremium || featureFlags.hasTopUpPremium) {
    gapTags.push('ad-hoc-premium-routing')
  }
  if (featureFlags.hasTieredBonus) {
    gapTags.push('tiered-bonus')
  }
  if (featureFlags.hasTieredFee) {
    gapTags.push('tiered-fee')
  }
  if (featureFlags.hasNonGuaranteedCharge) {
    gapTags.push('non-guaranteed-charges')
  }

  let bucket: SupportBucket
  if (totalCharacters < 500 || pageCount === 0) {
    bucket = 'parser-error'
    notes.push('Text layer too sparse for reliable audit.')
  } else if (
    featureFlags.hasMultiLife
    || featureFlags.hasDeathBenefitOptions
    || featureFlags.hasCapitalGuarantee
    || namedAccounts >= 3
  ) {
    bucket = 'C-major-gap'
  } else if (
    gapTags.length > 0
    || inferAccountModel(featureFlags) === 'Unclear'
  ) {
    bucket = 'B-extendable'
  } else {
    bucket = 'A-core-fit'
  }

  if (!featureFlags.hasEec) {
    notes.push('No clear EEC/surrender-charge marker found.')
  }
  if (!featureFlags.hasIua && !featureFlags.hasGrowthAccount && !featureFlags.hasRegularPremiumAccount) {
    notes.push('No obvious primary premium account marker found.')
  }

  return {
    fileName,
    insurer: inferInsurer(fileName),
    productName: inferProductName(fileName),
    pageCount,
    totalCharacters,
    featureFlags,
    accountModel: inferAccountModel(featureFlags),
    bucket,
    gapTags: [...new Set(gapTags)].sort(),
    notes,
  }
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  const counts = new Map<T, number>()
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])) as Record<T, number>
}

function topExamples(records: AuditRecord[], predicate: (record: AuditRecord) => boolean, limit = 8): string[] {
  return records.filter(predicate).slice(0, limit).map((record) => record.fileName)
}

function renderReport(records: AuditRecord[]): string {
  const total = records.length
  const byBucket = countBy(records.map((record) => record.bucket))
  const byInsurer = countBy(records.map((record) => record.insurer))
  const gapCounts = countBy(records.flatMap((record) => record.gapTags))

  const lines: string[] = [
    '# ILP Catalog Corpus Audit',
    '',
    `Generated at: ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    `- Summary PDFs audited: ${total}`,
    '- Brochures were excluded by filename heuristic.',
    '- This audit classifies economic/product structure against the current ILP engine, not parser success.',
    '',
    '## Support Buckets',
    '',
    `- A-core-fit: ${byBucket['A-core-fit'] ?? 0}`,
    `- B-extendable: ${byBucket['B-extendable'] ?? 0}`,
    `- C-major-gap: ${byBucket['C-major-gap'] ?? 0}`,
    `- parser-error: ${byBucket['parser-error'] ?? 0}`,
    '',
    '## By Insurer',
    '',
  ]

  for (const [insurer, count] of Object.entries(byInsurer)) {
    lines.push(`- ${insurer}: ${count}`)
  }

  lines.push('', '## Gap Counts', '')
  for (const [gap, count] of Object.entries(gapCounts)) {
    lines.push(`- ${gap}: ${count}`)
  }

  lines.push('', '## High-Impact Gaps', '')
  lines.push(`- Dynamic charge model: ${(gapCounts['dynamic-charge-model'] ?? 0)} products`)
  lines.push(`  Examples: ${topExamples(records, (record) => record.gapTags.includes('dynamic-charge-model')).join('; ') || 'none'}`)
  lines.push(`- Multi-life: ${(gapCounts['multi-life'] ?? 0)} products`)
  lines.push(`  Examples: ${topExamples(records, (record) => record.gapTags.includes('multi-life')).join('; ') || 'none'}`)
  lines.push(`- Death-benefit structure / capital guarantee: ${((gapCounts['death-benefit-structure'] ?? 0))} products`)
  lines.push(`  Examples: ${topExamples(records, (record) => record.gapTags.includes('death-benefit-structure')).join('; ') || 'none'}`)
  lines.push(`- Three-plus-account model: ${(gapCounts['three-plus-account-model'] ?? 0)} products`)
  lines.push(`  Examples: ${topExamples(records, (record) => record.gapTags.includes('three-plus-account-model')).join('; ') || 'none'}`)
  lines.push(`- Premium holiday / withdrawal behavior: ${(records.filter((record) => record.gapTags.includes('premium-holiday') || record.gapTags.includes('free-partial-withdrawal') || record.gapTags.includes('withdrawal-reduction-charges')).length)} products`)
  lines.push(`  Examples: ${topExamples(records, (record) => record.gapTags.includes('premium-holiday') || record.gapTags.includes('free-partial-withdrawal') || record.gapTags.includes('withdrawal-reduction-charges')).join('; ') || 'none'}`)

  lines.push('', '## Representative Major-Gap Products', '')
  for (const record of records.filter((entry) => entry.bucket === 'C-major-gap').slice(0, 15)) {
    lines.push(`- ${record.fileName}`)
    lines.push(`  Insurer: ${record.insurer}`)
    lines.push(`  Account model: ${record.accountModel}`)
    lines.push(`  Gap tags: ${record.gapTags.join(', ') || 'none'}`)
  }

  lines.push('', '## Recommended V1 Completeness Boundary', '')
  lines.push('- V1 can be near-complete for standard two-account ILPs with EEC, account-level fees, and bonus ladders.')
  lines.push('- To push V1 closer to corpus completeness, the first engine extensions to prioritize are:')
  lines.push('  1. dynamic charge model for insurance/protection/admin charges')
  lines.push('  2. richer account-model support for three-account products')
  lines.push('  3. product metadata + UI warnings for premium holiday, free withdrawals, and charge recovery mechanics')
  lines.push('- Multi-life and death-benefit-option/capital-guarantee products are the clearest candidates for partial support first, not full V1 parity.')

  return lines.join('\n')
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const entries = await readdir(MANUAL_CORPUS_DIR)
  const summaryFiles = entries.filter(isSummaryFile).sort()
  const records: AuditRecord[] = []

  for (const fileName of summaryFiles) {
    const filePath = path.join(MANUAL_CORPUS_DIR, fileName)
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) continue

    try {
      const extracted = await extractPdfText(filePath)
      const combinedText = extracted.pages.map((page) => page.text).join('\n')
      records.push(classify(combinedText, fileName, extracted.pageCount, extracted.totalCharacters))
    } catch (error) {
      records.push({
        fileName,
        insurer: inferInsurer(fileName),
        productName: inferProductName(fileName),
        pageCount: 0,
        totalCharacters: 0,
        featureFlags: {
          hasIua: false,
          hasAua: false,
          hasTopUpAccount: false,
          hasGrowthAccount: false,
          hasFlexAccount: false,
          hasAdditionalInvestmentAccount: false,
          hasRegularPremiumAccount: false,
          hasInsuranceCharge: false,
          hasAdminCharge: false,
          hasPolicyCharge: false,
          hasMultiLife: false,
          hasDeathBenefitOptions: false,
          hasCapitalGuarantee: false,
          hasPremiumHoliday: false,
          hasFreePartialWithdrawal: false,
          hasPartialWithdrawalCharge: false,
          hasBonusRecoveryCharge: false,
          hasDividendOption: false,
          hasRecurringSinglePremium: false,
          hasTopUpPremium: false,
          hasTieredBonus: false,
          hasTieredFee: false,
          hasNonGuaranteedCharge: false,
          hasEec: false,
        },
        accountModel: 'Unclear',
        bucket: 'parser-error',
        gapTags: [],
        notes: [error instanceof Error ? error.message : 'Unknown extraction error'],
      })
    }
  }

  await writeFile(JSON_PATH, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
  await writeFile(REPORT_PATH, renderReport(records), 'utf8')
  console.log(`Audited ${records.length} summary PDFs`)
  console.log(`Wrote corpus audit JSON to ${JSON_PATH}`)
  console.log(`Wrote corpus audit report to ${REPORT_PATH}`)
}

await main()
