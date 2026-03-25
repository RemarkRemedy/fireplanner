import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type IlpCatalogVariant = {
  id: string
  unsupportedItems?: string[]
}

type IlpCatalogProduct = {
  id: string
  productName: string
  insurer: string
  supportStatus: string
  structureStatus: string
  economicsStatus: string
  metadataOnlyBehaviors?: string[]
  variants: IlpCatalogVariant[]
}

type ReportRow = {
  productId: string
  productName: string
  insurer: string
  supportStatus: string
  structureStatus: string
  economicsStatus: string
  metadataOnlyBehaviorCount: number
  metadataOnlyBehaviors: string[]
  unsupportedItemCount: number
  unsupportedItems: string[]
  variantUnsupportedMatrix: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..', '..')
const PRODUCTS_PATH = path.join(ROOT_DIR, 'src/lib/data/generated/ilpCatalog.products.json')
const OUTPUT_DIR = path.join(ROOT_DIR, 'scripts/ilp-catalog/fixtures/audit')
const OUTPUT_CSV_PATH = path.join(OUTPUT_DIR, 'outside-current-models.csv')
const OUTPUT_MD_PATH = path.join(OUTPUT_DIR, 'outside-current-models.md')

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }

  return value
}

function collectRows(products: IlpCatalogProduct[]): ReportRow[] {
  return products.map((product) => {
    const metadataOnlyBehaviors = [...(product.metadataOnlyBehaviors ?? [])].sort()
    const unsupportedItems = [...new Set(
      product.variants.flatMap((variant) => variant.unsupportedItems ?? []),
    )].sort()
    const variantUnsupportedMatrix = product.variants
      .filter((variant) => (variant.unsupportedItems ?? []).length > 0)
      .map((variant) => `${variant.id}: ${(variant.unsupportedItems ?? []).join(' || ')}`)

    return {
      productId: product.id,
      productName: product.productName,
      insurer: product.insurer,
      supportStatus: product.supportStatus,
      structureStatus: product.structureStatus,
      economicsStatus: product.economicsStatus,
      metadataOnlyBehaviorCount: metadataOnlyBehaviors.length,
      metadataOnlyBehaviors,
      unsupportedItemCount: unsupportedItems.length,
      unsupportedItems,
      variantUnsupportedMatrix,
    }
  })
}

function renderMarkdown(rows: ReportRow[]): string {
  const lines = [
    '# ILP Outside-Current-Models Report',
    '',
    `Generated from \`src/lib/data/generated/ilpCatalog.products.json\`.`,
    '',
    `Policies covered: ${rows.length}`,
    '',
    '| Product ID | Product Name | Support | Metadata-only Behaviors | Variant Unsupported Items |',
    '| --- | --- | --- | --- | --- |',
  ]

  for (const row of rows) {
    const metadataCell = row.metadataOnlyBehaviors.length > 0
      ? row.metadataOnlyBehaviors.join('<br>')
      : '—'
    const unsupportedCell = row.unsupportedItems.length > 0
      ? row.unsupportedItems.join('<br>')
      : '—'

    lines.push(
      `| ${row.productId} | ${row.productName} | ${row.supportStatus}/${row.economicsStatus} | ${metadataCell} | ${unsupportedCell} |`,
    )
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- `Metadata-only Behaviors` are product-level residuals still declared outside the executable model.',
    '- `Variant Unsupported Items` are the unique unsupported statements aggregated across all variants for that product.',
    '- See the CSV companion for counts and per-variant unsupported matrices.',
  )

  return `${lines.join('\n')}\n`
}

function renderCsv(rows: ReportRow[]): string {
  const header = [
    'productId',
    'productName',
    'insurer',
    'supportStatus',
    'structureStatus',
    'economicsStatus',
    'metadataOnlyBehaviorCount',
    'metadataOnlyBehaviors',
    'unsupportedItemCount',
    'unsupportedItems',
    'variantUnsupportedMatrix',
  ]

  const lines = [header.join(',')]

  for (const row of rows) {
    lines.push([
      row.productId,
      row.productName,
      row.insurer,
      row.supportStatus,
      row.structureStatus,
      row.economicsStatus,
      String(row.metadataOnlyBehaviorCount),
      row.metadataOnlyBehaviors.join(' | '),
      String(row.unsupportedItemCount),
      row.unsupportedItems.join(' | '),
      row.variantUnsupportedMatrix.join(' ;; '),
    ].map(csvEscape).join(','))
  }

  return `${lines.join('\n')}\n`
}

async function main() {
  const products = JSON.parse(await readFile(PRODUCTS_PATH, 'utf8')) as IlpCatalogProduct[]
  const rows = collectRows(products)

  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_MD_PATH, renderMarkdown(rows))
  await writeFile(OUTPUT_CSV_PATH, renderCsv(rows))

  console.log(`Wrote outside-current-models markdown to ${OUTPUT_MD_PATH}`)
  console.log(`Wrote outside-current-models CSV to ${OUTPUT_CSV_PATH}`)
}

void main()
