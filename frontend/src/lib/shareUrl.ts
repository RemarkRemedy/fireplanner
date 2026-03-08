/**
 * Share Plan via URL.
 *
 * The compressed payload carries the v2 portability envelope, and the decoder
 * resolves it once into runtime-ready store data for the current app.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import {
  applyResolvedPortabilityData,
  buildPortabilityEnvelope,
  resolvePortabilityData,
  type ResolvedPortabilityData,
} from './storeRegistry'

const MAX_URL_LENGTH = 8000

/** Read all store data from localStorage and compress to a URL-safe string. */
export function encodeStoresForUrl(): string {
  return compressToEncodedURIComponent(JSON.stringify(buildPortabilityEnvelope()))
}

/** Decode a compressed string back to resolved portability data. Returns null on failure. */
export function decodeStoresFromUrl(compressed: string): ResolvedPortabilityData | null {
  try {
    const json = decompressFromEncodedURIComponent(compressed)
    if (!json) return null
    return resolvePortabilityData(JSON.parse(json), 'share-url')
  } catch {
    return null
  }
}

/** Generate the full shareable URL with ?plan= query parameter. */
export function generateShareUrl(): { url: string; tooLong: boolean } {
  const encoded = encodeStoresForUrl()
  const base = window.location.origin + window.location.pathname
  const url = `${base}?plan=${encoded}`
  return { url, tooLong: url.length > MAX_URL_LENGTH }
}

/** Write decoded store data to localStorage. Does NOT reload — caller handles that. */
export function applyStoreData(resolved: ResolvedPortabilityData): void {
  applyResolvedPortabilityData(resolved)
}

/** Check if the current URL has a ?plan= parameter.
 *  Uses manual parsing instead of URLSearchParams because lz-string's
 *  compressToEncodedURIComponent output contains literal `+` characters,
 *  and URLSearchParams decodes `+` as space (per application/x-www-form-urlencoded),
 *  which corrupts the compressed data.
 */
export function getPlanFromUrl(): string | null {
  const match = window.location.search.match(/[?&]plan=([^&]*)/)
  return match ? match[1] : null
}

/** Strip the ?plan= parameter from the URL without triggering navigation. */
export function stripPlanFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('plan')
  window.history.replaceState({}, '', url.toString())
}
