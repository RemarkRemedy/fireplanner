import type { IlpCatalogPublishedCorridor, IlpTemplateVariant } from '@/lib/ilp-catalog/types'

function titleCaseToken(token: string): string {
  if (/^\d+$/.test(token)) {
    return token
  }

  return token.charAt(0).toUpperCase() + token.slice(1)
}

function deriveVariantSuffix(variant: IlpTemplateVariant): string | null {
  const baseId = variant.mipBasis === 'open-ended'
    ? `${variant.currency.toLowerCase()}-open-ended`
    : `${variant.currency.toLowerCase()}-mip-${variant.mipLength}`
  if (!variant.id.startsWith(baseId)) {
    return null
  }

  const rawSuffix = variant.id.slice(baseId.length).replace(/^-/, '')
  if (!rawSuffix) {
    return null
  }

  return rawSuffix
    .split('-')
    .map(titleCaseToken)
    .join(' ')
}

export function formatCatalogVariantLabel(variant: IlpTemplateVariant): string {
  const iipMatch = variant.id.match(/^[a-z]+-iip-(\d+)/)
  const baseLabel = iipMatch
    ? `${variant.currency} / IIP ${iipMatch[1]} years`
    : variant.mipBasis === 'open-ended'
      ? `${variant.currency} / Open-ended`
      : `${variant.currency} / MIP ${variant.mipLength}`
  const suffix = deriveVariantSuffix(variant)
  return suffix ? `${baseLabel} (${suffix})` : baseLabel
}

export function formatCatalogPublishedCorridorLabel(corridor: IlpCatalogPublishedCorridor): string {
  return corridor.label
}
