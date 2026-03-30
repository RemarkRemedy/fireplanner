import { useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { formatCatalogVariantLabel } from '@/lib/ilp-catalog/labels'
import type { IlpCatalogProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'

interface ProductPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (product: IlpCatalogProduct, variant: IlpTemplateVariant) => void
}

function supportCopy(product: IlpCatalogProduct): string {
  if (product.supportStatus === 'supported') {
    return 'Models the summary-described economics currently justified in this dashboard.'
  }

  return 'Needs source review for some summary-described behaviors. The dashboard keeps claims narrow to the slice modeled today.'
}

export function ProductPickerDialog({ open, onOpenChange, onSelect }: ProductPickerDialogProps) {
  const { products, manifest } = getIlpCatalog()
  const supportedProducts = products.filter((product) => product.supportStatus !== 'parser-error')
  const [query, setQuery] = useState('')
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const visibleProducts = supportedProducts.filter((product) => {
    if (normalizedQuery.length === 0) return true
    return `${product.insurer} ${product.productName}`.toLowerCase().includes(normalizedQuery)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose ILP product</DialogTitle>
          <DialogDescription>
            Seed a new ILP draft from the manual product catalog. Catalog version {manifest.catalogVersion}.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search insurer or product name"
            className="pl-9"
          />
        </div>

        <div className="space-y-3">
          {visibleProducts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No catalog products matched this search.
              </CardContent>
            </Card>
          ) : visibleProducts.map((product) => (
            <Card key={product.id}>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">{product.insurer}</div>
                  <div className="font-semibold">{product.productName}</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={product.supportStatus === 'supported' ? 'default' : 'secondary'}>
                      {product.supportStatus === 'supported' ? 'Supported' : 'Needs review'}
                    </Badge>
                    <Badge variant="outline">
                      {product.economicsStatus === 'supported' ? 'Modeled economics' : 'Narrower modeled scope'}
                    </Badge>
                  </div>
                  {(supportCopy(product) || product.warnings.length > 0) && (
                    <div className="pt-1">
                      <button
                        type="button"
                        className="text-xs font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setExpandedProductId((current) => (current === product.id ? null : product.id))}
                      >
                        {expandedProductId === product.id ? 'Hide model notes' : 'Show model notes'}
                      </button>
                    </div>
                  )}
                  {expandedProductId === product.id && (
                    <div className="space-y-2 pt-1">
                      <div className="text-xs text-muted-foreground">
                        {supportCopy(product)}
                      </div>
                      {product.warnings.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {product.warnings[0]}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {product.variants.map((variant) => (
                    <Button
                      key={variant.id}
                      type="button"
                      variant="outline"
                      className="justify-between"
                      onClick={() => onSelect(product, variant)}
                    >
                      <span>{formatCatalogVariantLabel(variant)}</span>
                      <span className="text-xs text-muted-foreground">Use template</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
