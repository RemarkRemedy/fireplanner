import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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
  manualByDesignCurrentStateCount: number
  manualByDesignCurrentStateItems: string[]
  unsupportedItemCount: number
  unsupportedItems: string[]
  variantManualByDesignMatrix: string[]
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

export function isManualByDesignCurrentStateItem(item: string): boolean {
  const normalized = item.toLowerCase()

  if (!normalized.includes('manual')) {
    return false
  }

  const manualSignals = [
    'manual by design',
    'manual current',
    'manual remaining aggregate ti cap',
    'manual remaining aggregate tpd cap',
    'manual claim-amount',
    'manual residual-death',
    'manual current refund',
    'manual claim-amount input',
    'must be maintained manually',
  ]
  const currentStateSignals = [
    'current-state',
    'current admitted-state',
    'current death benefit',
    'current death-benefit',
    'current terminal-illness',
    'current tpd',
    'current accidental-death',
    'current residual death-benefit',
    'ti claim today',
    'tpd claim today',
    'amount owing',
    'insured amount',
    'sum assured',
    'no lapse privilege mode',
    'net protected premium base',
    'protected death-cover base',
    'accidental-death regular-premium floor',
    'remaining aggregate ti cap',
    'remaining aggregate tpd cap',
    'policy-termination state',
    'refund inputs',
  ]

  return manualSignals.some((signal) => normalized.includes(signal))
    && currentStateSignals.some((signal) => normalized.includes(signal))
}

export function collectRows(products: IlpCatalogProduct[]): ReportRow[] {
  return products.map((product) => {
    const metadataOnlyBehaviors = [...(product.metadataOnlyBehaviors ?? [])].sort()
    const rawUnsupportedItems = [...new Set(
      product.variants.flatMap((variant) => variant.unsupportedItems ?? []),
    )].sort()
    const manualByDesignCurrentStateItems = rawUnsupportedItems
      .filter((item) => isManualByDesignCurrentStateItem(item))
    const unsupportedItems = rawUnsupportedItems
      .filter((item) => !isManualByDesignCurrentStateItem(item))
    const variantManualByDesignMatrix = product.variants
      .map((variant) => ({
        id: variant.id,
        items: (variant.unsupportedItems ?? []).filter((item) => isManualByDesignCurrentStateItem(item)),
      }))
      .filter((variant) => variant.items.length > 0)
      .map((variant) => `${variant.id}: ${variant.items.join(' || ')}`)
    const variantUnsupportedMatrix = product.variants
      .map((variant) => ({
        id: variant.id,
        items: (variant.unsupportedItems ?? []).filter((item) => !isManualByDesignCurrentStateItem(item)),
      }))
      .filter((variant) => variant.items.length > 0)
      .map((variant) => `${variant.id}: ${variant.items.join(' || ')}`)

    return {
      productId: product.id,
      productName: product.productName,
      insurer: product.insurer,
      supportStatus: product.supportStatus,
      structureStatus: product.structureStatus,
      economicsStatus: product.economicsStatus,
      metadataOnlyBehaviorCount: metadataOnlyBehaviors.length,
      metadataOnlyBehaviors,
      manualByDesignCurrentStateCount: manualByDesignCurrentStateItems.length,
      manualByDesignCurrentStateItems,
      unsupportedItemCount: unsupportedItems.length,
      unsupportedItems,
      variantManualByDesignMatrix,
      variantUnsupportedMatrix,
    }
  })
}

export function renderMarkdown(rows: ReportRow[]): string {
  const lines = [
    '# ILP Outside-Current-Models Report',
    '',
    `Generated from \`src/lib/data/generated/ilpCatalog.products.json\`.`,
    '',
    `Policies covered: ${rows.length}`,
    '',
    '| Product ID | Product Name | Support | Metadata-only Behaviors | Manual-by-Design Current-State Notes | Variant Unsupported Items |',
    '| --- | --- | --- | --- | --- | --- |',
  ]

  for (const row of rows) {
    const metadataCell = row.metadataOnlyBehaviors.length > 0
      ? row.metadataOnlyBehaviors.join('<br>')
      : '—'
    const manualByDesignCell = row.manualByDesignCurrentStateItems.length > 0
      ? row.manualByDesignCurrentStateItems.join('<br>')
      : '—'
    const unsupportedCell = row.unsupportedItems.length > 0
      ? row.unsupportedItems.join('<br>')
      : '—'

    lines.push(
      `| ${row.productId} | ${row.productName} | ${row.supportStatus}/${row.economicsStatus} | ${metadataCell} | ${manualByDesignCell} | ${unsupportedCell} |`,
    )
  }

  lines.push(
    '',
    '## Notes',
    '',
    '- `Metadata-only Behaviors` are product-level residuals still declared outside the executable model.',
    '- `Manual-by-Design Current-State Notes` are user-supplied present-day policy facts or oracle-like claim/debt states that the app cannot observe directly; they are intentionally separated from blocker-style unsupported items.',
    '- `Variant Unsupported Items` are the unique unsupported statements aggregated across all variants for that product after excluding manual-by-design current-state notes.',
    '- See the CSV companion for counts and per-variant unsupported matrices.',
  )

  return `${lines.join('\n')}\n`
}

export function renderCsv(rows: ReportRow[]): string {
  const header = [
    'productId',
    'productName',
    'insurer',
    'supportStatus',
    'structureStatus',
    'economicsStatus',
    'metadataOnlyBehaviorCount',
    'metadataOnlyBehaviors',
    'manualByDesignCurrentStateCount',
    'manualByDesignCurrentStateItems',
    'unsupportedItemCount',
    'unsupportedItems',
    'variantManualByDesignMatrix',
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
      String(row.manualByDesignCurrentStateCount),
      row.manualByDesignCurrentStateItems.join(' | '),
      String(row.unsupportedItemCount),
      row.unsupportedItems.join(' | '),
      row.variantManualByDesignMatrix.join(' ;; '),
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
