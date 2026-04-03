import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getIlpCatalog } from '@/lib/ilp-catalog/getIlpCatalog'
import { formatCatalogPublishedCorridorLabel, formatCatalogVariantLabel } from '@/lib/ilp-catalog/labels'
import type { IlpCatalogPublishedCorridor, IlpCatalogResolvedProduct, IlpTemplateVariant } from '@/lib/ilp-catalog/types'
import { cn } from '@/lib/utils'

const INITIAL_VISIBLE_DISABLED_CORRIDORS = 6

function isPublishedOnlyProduct(product: IlpCatalogResolvedProduct): boolean {
  return product.variants.length === 0 && product.publishedUnmodeledCorridors.length > 0
}

interface ProductPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (product: IlpCatalogResolvedProduct, variant: IlpTemplateVariant) => void
}

function supportCopy(product: IlpCatalogResolvedProduct): string {
  if (isPublishedOnlyProduct(product)) {
    return 'This published corridor family is visible in the catalog, but no executable template is modeled yet in this dashboard.'
  }

  if (product.supportStatus === 'supported') {
    return 'Models the summary-described economics currently justified in this dashboard.'
  }

  return 'Needs source review for some summary-described behaviors. The dashboard keeps claims narrow to the slice modeled today.'
}

function disabledCorridorTooltip(
  product: IlpCatalogResolvedProduct,
  corridor: IlpCatalogPublishedCorridor,
): string | null {
  if (isPublishedOnlyProduct(product) && product.sourceClass === 'brochure-only') {
    return 'Source file not found. This is intentionally kept disabled until the product summary is available.'
  }

  const normalizedReason = corridor.reason.trim().toLowerCase()
  if (normalizedReason.includes('source file')) {
    return 'Source file not found. This is intentionally kept disabled until the product summary is available.'
  }

  return null
}

export function ProductPickerDialog({ open, onOpenChange, onSelect }: ProductPickerDialogProps) {
  const { products, manifest } = getIlpCatalog()
  const supportedProducts = products.filter((product) => product.supportStatus !== 'parser-error') as IlpCatalogResolvedProduct[]
  const [query, setQuery] = useState('')
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null)
  const [expandedDisabledProductIds, setExpandedDisabledProductIds] = useState<string[]>([])

  const normalizedQuery = query.trim().toLowerCase()
  const groupedProducts = useMemo(() => {
    const filtered = supportedProducts.filter((product) => {
      if (normalizedQuery.length === 0) return true
      return `${product.insurer} ${product.productName}`.toLowerCase().includes(normalizedQuery)
    })

    const INSURER_ALIASES: Record<string, string> = { 'FWD': 'FWD Singapore' }
    const groups = new Map<string, IlpCatalogResolvedProduct[]>()
    filtered.forEach((product) => {
      const groupName = INSURER_ALIASES[product.insurer] ?? product.insurer
      const insurerProducts = groups.get(groupName)
      if (insurerProducts) {
        insurerProducts.push(product)
      } else {
        groups.set(groupName, [product])
      }
    })

    return Array.from(groups.entries())
      .map(([insurer, insurerProducts]) => [
        insurer,
        insurerProducts.sort((a, b) => a.productName.localeCompare(b.productName, undefined, { numeric: true })),
      ] satisfies [string, IlpCatalogResolvedProduct[]])
      .sort(([a], [b]) => a.localeCompare(b))
  }, [supportedProducts, normalizedQuery])

  const allInsurerKeys = useMemo(
    () => groupedProducts.map(([insurer]) => insurer),
    [groupedProducts],
  )
  const [openGroups, setOpenGroups] = useState<string[]>([])

  useEffect(() => {
    if (normalizedQuery.length === 0) {
      return
    }

    const desiredOpenGroups = allInsurerKeys
    const matchesDesiredGroups =
      desiredOpenGroups.length === openGroups.length
      && desiredOpenGroups.every((group, index) => openGroups[index] === group)

    if (!matchesDesiredGroups) {
      setOpenGroups(desiredOpenGroups)
    }
  }, [allInsurerKeys, normalizedQuery, openGroups])

  useEffect(() => {
    if (open) {
      return
    }

    setQuery('')
    setOpenGroups([])
    setExpandedProductId(null)
    setExpandedDisabledProductIds([])
  }, [open])

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
          {groupedProducts.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No catalog products matched this search.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" value={openGroups} onValueChange={setOpenGroups} className="space-y-3">
              {groupedProducts.map(([insurer, insurerProducts]) => (
                <AccordionItem key={insurer} value={insurer} className="rounded-lg border px-4">
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    <div className="flex flex-1 items-center justify-between gap-3 pr-4">
                      <span className="font-semibold">{insurer}</span>
                      <Badge variant="outline">{insurerProducts.length} products</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-1">
                    {insurerProducts.map((product) => (
                      <Card key={product.id}>
                        <CardContent className="space-y-4 pt-6">
                          {(() => {
                            const publishedCorridors = product.publishedUnmodeledCorridors
                            const disabledExpanded = expandedDisabledProductIds.includes(product.id)
                            const visiblePublishedCorridors = disabledExpanded
                              ? publishedCorridors
                              : publishedCorridors.slice(0, INITIAL_VISIBLE_DISABLED_CORRIDORS)
                            const publishedOnly = isPublishedOnlyProduct(product)

                            return (
                              <>
                                <div className="space-y-1">
                                  <div className="text-sm text-muted-foreground">{product.insurer}</div>
                                  <div className="font-semibold">{product.productName}</div>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant={publishedOnly ? 'secondary' : product.supportStatus === 'supported' ? 'default' : 'secondary'}>
                                      {publishedOnly ? 'Published only' : product.supportStatus === 'supported' ? 'Supported' : 'Needs review'}
                                    </Badge>
                                    <Badge variant="outline">
                                      {publishedOnly
                                        ? 'Disabled corridors only'
                                        : product.economicsStatus === 'supported'
                                          ? 'Modeled economics'
                                          : 'Narrower modeled scope'}
                                    </Badge>
                                    {publishedCorridors.length > 0 && !publishedOnly && (
                                      <Badge variant="outline">
                                        {publishedCorridors.length} published corridors not modeled
                                      </Badge>
                                    )}
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

                                {product.variants.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Executable templates
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                      {product.variants.map((variant) => (
                                        <Button
                                          key={variant.id}
                                          type="button"
                                          variant="outline"
                                          className="h-auto justify-between whitespace-normal text-left"
                                          onClick={() => onSelect(product, variant)}
                                        >
                                          <span>{formatCatalogVariantLabel(variant)}</span>
                                          <span className="text-xs text-muted-foreground">Use template</span>
                                        </Button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {publishedCorridors.length > 0 && (
                                  <div className={cn('space-y-2 border-t pt-4', product.variants.length === 0 && 'border-dashed')}>
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                        Published in source, not modeled yet
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {publishedCorridors.length} corridors
                                      </div>
                                    </div>
                                    <TooltipProvider delayDuration={150}>
                                      <div className="grid gap-2 md:grid-cols-2">
                                        {visiblePublishedCorridors.map((corridor) => {
                                          const tooltip = disabledCorridorTooltip(product, corridor)
                                          const button = (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              disabled
                                              className="h-auto w-full justify-between whitespace-normal border-dashed text-left text-muted-foreground disabled:opacity-100"
                                            >
                                              <span className="flex flex-col items-start gap-1">
                                                <span>{formatCatalogPublishedCorridorLabel(corridor)}</span>
                                                <span className="text-xs text-muted-foreground">{corridor.reason}</span>
                                              </span>
                                              <span className="text-xs text-muted-foreground">Unavailable</span>
                                            </Button>
                                          )

                                          if (tooltip == null) {
                                            return (
                                              <div key={corridor.id}>
                                                {button}
                                              </div>
                                            )
                                          }

                                          return (
                                            <Tooltip key={corridor.id}>
                                              <TooltipTrigger asChild>
                                                <span tabIndex={0} className="block">
                                                  {button}
                                                </span>
                                              </TooltipTrigger>
                                              <TooltipContent>{tooltip}</TooltipContent>
                                            </Tooltip>
                                          )
                                        })}
                                      </div>
                                    </TooltipProvider>
                                    {publishedCorridors.length > INITIAL_VISIBLE_DISABLED_CORRIDORS && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="px-0 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => setExpandedDisabledProductIds((current) => (
                                          current.includes(product.id)
                                            ? current.filter((productId) => productId !== product.id)
                                            : [...current, product.id]
                                        ))}
                                      >
                                        {disabledExpanded
                                          ? 'Show fewer corridors'
                                          : `Show ${publishedCorridors.length - INITIAL_VISIBLE_DISABLED_CORRIDORS} more corridors`}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </CardContent>
                      </Card>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
