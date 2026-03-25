import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type IlpCatalogProduct = {
  id: string
  productName: string
  insurer: string
  supportStatus: string
  structureStatus: string
  economicsStatus: string
  modeledEconomics?: string[]
}

type CoverageNeedle =
  | 'kernel:current-death-benefit-estimate'
  | 'kernel:current-ti-benefit-estimate'
  | 'kernel:current-ti-benefit-after-tpd-estimate'
  | 'kernel:current-residual-death-benefit-after-ti-estimate'
  | 'kernel:current-accidental-death-benefit-estimate'
  | 'kernel:current-accidental-tpd-benefit-estimate'
  | 'kernel:current-accidental-disability-benefit-estimate'
  | 'kernel:current-tpd-benefit-estimate'
  | 'kernel:current-residual-death-benefit-after-tpd-estimate'

type CoverageKind = 'calculator' | 'review' | 'template'

type CoverageRow = {
  productId: string
  productName: string
  insurer: string
  supportStatus: string
  economicsStatus: string
  kernel: CoverageNeedle
  calculatorCoverage: boolean
  reviewCoverage: boolean
  templateCoverage: boolean
  matchedCalculatorNeedle: string | null
  matchedReviewNeedle: string | null
  matchedTemplateNeedle: string | null
}

type CoverageClassification = 'covered' | 'suspicious-gap' | 'template-only-note'

type MetricNeedles = {
  calculator: string[]
  review: string[]
  template: string[]
}

const CURRENT_BENEFIT_KERNELS: CoverageNeedle[] = [
  'kernel:current-death-benefit-estimate',
  'kernel:current-ti-benefit-estimate',
  'kernel:current-ti-benefit-after-tpd-estimate',
  'kernel:current-residual-death-benefit-after-ti-estimate',
  'kernel:current-accidental-death-benefit-estimate',
  'kernel:current-accidental-tpd-benefit-estimate',
  'kernel:current-accidental-disability-benefit-estimate',
  'kernel:current-tpd-benefit-estimate',
  'kernel:current-residual-death-benefit-after-tpd-estimate',
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const PRODUCTS_PATH = path.join(ROOT_DIR, 'src/lib/data/generated/ilpCatalog.products.json')
const CALCULATOR_TEST_PATH = path.join(ROOT_DIR, 'src/lib/calculations/ilp.test.ts')
const REVIEW_TEST_PATH = path.join(ROOT_DIR, 'src/pages/IlpReviewPage.test.tsx')
const TEMPLATE_TEST_PATH = path.join(ROOT_DIR, 'src/lib/ilp-catalog/templateToPolicy.test.ts')
const OUTPUT_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit')
const OUTPUT_MD_PATH = path.join(OUTPUT_DIR, 'current-benefit-coverage-gaps.md')
const OUTPUT_CSV_PATH = path.join(OUTPUT_DIR, 'current-benefit-coverage-gaps.csv')

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function buildSearchNeedles(product: IlpCatalogProduct): string[] {
  const needles = new Set<string>([product.id, product.productName])
  const withoutParenthetical = product.productName.replace(/\s*\([^)]*\)/g, '').trim()
  if (withoutParenthetical.length > 0) {
    needles.add(withoutParenthetical)
  }

  return [...needles].sort((left, right) => right.length - left.length)
}

function metricNeedlesFor(kernel: CoverageNeedle): MetricNeedles {
  switch (kernel) {
    case 'kernel:current-death-benefit-estimate':
      return {
        calculator: ['death benefit today', 'current death-benefit estimate'],
        review: ['death benefit today', 'current-state death-benefit estimate'],
        template: [kernel],
      }
    case 'kernel:current-ti-benefit-estimate':
      return {
        calculator: ['ti benefit today', 'terminal-illness benefit estimate'],
        review: ['ti benefit today', 'terminal-illness benefit estimate'],
        template: [kernel],
      }
    case 'kernel:current-ti-benefit-after-tpd-estimate':
      return {
        calculator: ['ti benefit after a tpd claim today', 'ti benefit after tpd claim today'],
        review: ['ti benefit after tpd claim today'],
        template: [kernel],
      }
    case 'kernel:current-residual-death-benefit-after-ti-estimate':
      return {
        calculator: ['residual death benefit after a ti claim today', 'death benefit after ti claim today'],
        review: ['death benefit after ti claim today', 'residual death-benefit estimate after a ti claim today'],
        template: [kernel],
      }
    case 'kernel:current-accidental-death-benefit-estimate':
      return {
        calculator: ['accidental death benefit today', 'current accidental-death estimate'],
        review: ['accidental death benefit today', 'current accidental-death estimate'],
        template: [kernel],
      }
    case 'kernel:current-accidental-tpd-benefit-estimate':
      return {
        calculator: ['accidental tpd benefit today', 'current accidental-tpd estimate'],
        review: ['accidental tpd benefit today', 'current accidental-tpd estimate'],
        template: [kernel],
      }
    case 'kernel:current-accidental-disability-benefit-estimate':
      return {
        calculator: ['accidental disability benefit today'],
        review: ['accidental disability benefit today'],
        template: [kernel],
      }
    case 'kernel:current-tpd-benefit-estimate':
      return {
        calculator: ['tpd benefit today', 'current tpd benefit estimate'],
        review: ['tpd benefit today', 'current tpd benefit estimate'],
        template: [kernel],
      }
    case 'kernel:current-residual-death-benefit-after-tpd-estimate':
      return {
        calculator: ['residual death benefit after a tpd claim today', 'death benefit after tpd claim today'],
        review: ['death benefit after tpd claim today', 'current residual death-benefit estimate after a tpd claim today'],
        template: [kernel],
      }
  }
}

function splitTestBlocks(haystack: string): string[] {
  const parts = haystack.split(/\n\s*it\(/)
  if (parts.length <= 1) {
    return [haystack]
  }

  return [
    parts[0],
    ...parts.slice(1).map((part) => `it(${part}`),
  ]
}

function findMatchingNeedle(
  haystack: string,
  productNeedles: string[],
  metricNeedles: string[],
): string | null {
  const blocks = splitTestBlocks(haystack)
  const normalizedProductNeedles = productNeedles.map((needle) => needle.toLowerCase())
  const normalizedMetricNeedles = metricNeedles.map((needle) => needle.toLowerCase())

  for (const block of blocks) {
    const normalizedBlock = block.toLowerCase()
    for (const productNeedle of normalizedProductNeedles) {
      if (!normalizedBlock.includes(productNeedle)) {
        continue
      }

      for (const metricNeedle of normalizedMetricNeedles) {
        if (normalizedBlock.includes(metricNeedle)) {
          return `${productNeedle} + ${metricNeedle}`
          }
      }
    }
  }

  return null
}

function collectRows(
  products: IlpCatalogProduct[],
  calculatorTests: string,
  reviewTests: string,
  templateTests: string,
): CoverageRow[] {
  const rows: CoverageRow[] = []

  for (const product of products) {
    const modeledEconomics = product.modeledEconomics ?? []
    const needles = buildSearchNeedles(product)

    for (const kernel of CURRENT_BENEFIT_KERNELS) {
      if (!modeledEconomics.includes(kernel)) continue

      const metricNeedles = metricNeedlesFor(kernel)

      const matchedCalculatorNeedle = findMatchingNeedle(calculatorTests, needles, metricNeedles.calculator)
      const matchedReviewNeedle = findMatchingNeedle(reviewTests, needles, metricNeedles.review)
      const matchedTemplateNeedle = findMatchingNeedle(templateTests, needles, metricNeedles.template)

      rows.push({
        productId: product.id,
        productName: product.productName,
        insurer: product.insurer,
        supportStatus: product.supportStatus,
        economicsStatus: product.economicsStatus,
        kernel,
        calculatorCoverage: matchedCalculatorNeedle != null,
        reviewCoverage: matchedReviewNeedle != null,
        templateCoverage: matchedTemplateNeedle != null,
        matchedCalculatorNeedle,
        matchedReviewNeedle,
        matchedTemplateNeedle,
      })
    }
  }

  return rows.sort((left, right) => (
    left.productName.localeCompare(right.productName)
    || left.kernel.localeCompare(right.kernel)
  ))
}

function classifyRow(row: CoverageRow): CoverageClassification {
  if (!row.calculatorCoverage || !row.reviewCoverage) {
    return 'suspicious-gap'
  }

  if (!row.templateCoverage) {
    return 'template-only-note'
  }

  return 'covered'
}

function renderMarkdown(rows: CoverageRow[]): string {
  const suspiciousGaps = rows.filter((row) => classifyRow(row) === 'suspicious-gap')
  const templateOnlyNotes = rows.filter((row) => classifyRow(row) === 'template-only-note')

  const lines = [
    '# Current-Benefit Coverage Gaps',
    '',
    'Generated from the catalog plus the focused calculator, review, and template test files.',
    '',
    `Rows scanned: ${rows.length}`,
    `Suspicious gaps: ${suspiciousGaps.length}`,
    `Template-only notes: ${templateOnlyNotes.length}`,
    '',
    '## Suspicious Gaps',
    '',
    '| Product | Kernel | Calc | Review | Template | Matched Needles |',
    '| --- | --- | --- | --- | --- | --- |',
  ]

  for (const row of suspiciousGaps) {
    const matches = [
      `calc=${row.matchedCalculatorNeedle ?? '—'}`,
      `review=${row.matchedReviewNeedle ?? '—'}`,
      `template=${row.matchedTemplateNeedle ?? '—'}`,
    ].join('<br>')
    lines.push(
      `| ${row.productName} | ${row.kernel} | ${row.calculatorCoverage ? 'yes' : 'no'} | ${row.reviewCoverage ? 'yes' : 'no'} | ${row.templateCoverage ? 'yes' : 'no'} | ${matches} |`,
    )
  }

  if (suspiciousGaps.length === 0) {
    lines.push('| — | — | — | — | — | No suspicious calc/review gaps detected |')
  }

  lines.push(
    '',
    '## Template-Only Notes',
    '',
    '| Product | Kernel | Calc | Review | Template | Matched Needles |',
    '| --- | --- | --- | --- | --- | --- |',
  )

  for (const row of templateOnlyNotes) {
    const matches = [
      `calc=${row.matchedCalculatorNeedle ?? '—'}`,
      `review=${row.matchedReviewNeedle ?? '—'}`,
      `template=${row.matchedTemplateNeedle ?? '—'}`,
    ].join('<br>')
    lines.push(
      `| ${row.productName} | ${row.kernel} | ${row.calculatorCoverage ? 'yes' : 'no'} | ${row.reviewCoverage ? 'yes' : 'no'} | ${row.templateCoverage ? 'yes' : 'no'} | ${matches} |`,
    )
  }

  if (templateOnlyNotes.length === 0) {
    lines.push('| — | — | — | — | — | No template-only notes |')
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- Coverage is heuristic and search-based; a match counts when the test file contains the product id, full product name, or a simplified product name with parenthetical suffixes removed.',
    '- The report is meant to rank suspicious gaps, not to prove absence of coverage.',
  )

  return `${lines.join('\n')}\n`
}

function renderCsv(rows: CoverageRow[]): string {
  const header = [
    'classification',
    'productId',
    'productName',
    'insurer',
    'supportStatus',
    'economicsStatus',
    'kernel',
    'calculatorCoverage',
    'reviewCoverage',
    'templateCoverage',
    'matchedCalculatorNeedle',
    'matchedReviewNeedle',
    'matchedTemplateNeedle',
  ]

  const lines = [header.join(',')]

  for (const row of rows) {
    lines.push([
      classifyRow(row),
      row.productId,
      row.productName,
      row.insurer,
      row.supportStatus,
      row.economicsStatus,
      row.kernel,
      String(row.calculatorCoverage),
      String(row.reviewCoverage),
      String(row.templateCoverage),
      row.matchedCalculatorNeedle ?? '',
      row.matchedReviewNeedle ?? '',
      row.matchedTemplateNeedle ?? '',
    ].map(csvEscape).join(','))
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const [productsRaw, calculatorTests, reviewTests, templateTests] = await Promise.all([
    readFile(PRODUCTS_PATH, 'utf8'),
    readFile(CALCULATOR_TEST_PATH, 'utf8'),
    readFile(REVIEW_TEST_PATH, 'utf8'),
    readFile(TEMPLATE_TEST_PATH, 'utf8'),
  ])

  const products = JSON.parse(productsRaw) as IlpCatalogProduct[]
  const rows = collectRows(products, calculatorTests, reviewTests, templateTests)

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_MD_PATH, renderMarkdown(rows))
  await writeFile(OUTPUT_CSV_PATH, renderCsv(rows))

  const suspiciousGaps = rows.filter((row) => classifyRow(row) === 'suspicious-gap')
  const templateOnlyNotes = rows.filter((row) => classifyRow(row) === 'template-only-note')
  console.log(`Scanned ${rows.length} current-benefit coverage rows`)
  console.log(`Found ${suspiciousGaps.length} suspicious gaps`)
  console.log(`Found ${templateOnlyNotes.length} template-only notes`)
  console.log(`Wrote markdown to ${OUTPUT_MD_PATH}`)
  console.log(`Wrote CSV to ${OUTPUT_CSV_PATH}`)
}

void main()
