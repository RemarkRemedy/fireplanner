import type { IlpCatalogPublishedCorridor, IlpTemplateVariant } from '@/lib/ilp-catalog/types'

function titleCaseToken(token: string): string {
  if (/^\d+$/.test(token)) {
    return token
  }

  return token.charAt(0).toUpperCase() + token.slice(1)
}

function formatYearCount(years: number): string {
  return `${years} year${years === 1 ? '' : 's'}`
}

function deriveMetadataVariantLabel(variant: IlpTemplateVariant): string | null {
  if (variant.paymentStructure === 'ppt' && variant.premiumPaymentTermYears != null) {
    const parts = [`${variant.currency} / Premium Payment Term ${formatYearCount(variant.premiumPaymentTermYears)}`]
    if (variant.policyTermYears != null) {
      parts.push(`Policy Term ${formatYearCount(variant.policyTermYears)}`)
    }
    return parts.join(' / ')
  }

  if (
    variant.paymentStructure === 'single-pay'
    && (variant.mipLength != null || variant.policyTermYears != null || variant.mipBasis !== 'open-ended')
  ) {
    const parts = [`${variant.currency} / Single Pay`]
    if (variant.mipLength != null) {
      parts.push(`MIP ${formatYearCount(variant.mipLength)}`)
    }
    if (variant.policyTermYears != null) {
      parts.push(`Policy Term ${formatYearCount(variant.policyTermYears)}`)
    }
    return parts.join(' / ')
  }

  if (variant.paymentStructure === 'flexi' && variant.mipLength != null && variant.flexiTerm != null) {
    return `${variant.currency} / MIP ${variant.mipLength} (Flexi ${variant.flexiTerm})`
  }

  if (variant.paymentStructure === 'iip' && variant.premiumPaymentTermYears != null) {
    return `${variant.currency} / IIP ${formatYearCount(variant.premiumPaymentTermYears)}`
  }

  return null
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
  const metadataLabel = deriveMetadataVariantLabel(variant)
  if (metadataLabel) {
    return metadataLabel
  }

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
