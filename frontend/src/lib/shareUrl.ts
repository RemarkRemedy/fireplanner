/**
 * Share Plan via URL.
 *
 * The compressed payload now carries the v2 portability envelope, while the
 * decoder still returns a mixed-mode runtime store map for the current app.
 */

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import {
  applyResolvedPortabilityData,
  buildPortabilityEnvelope,
  resolvePortabilityData,
} from './storeRegistry'

const MAX_URL_LENGTH = 8000

/** Read all store data from localStorage and compress to a URL-safe string. */
export function encodeStoresForUrl(): string {
  return compressToEncodedURIComponent(JSON.stringify(buildPortabilityEnvelope()))
}

/** Decode a compressed string back to store data. Returns null on failure. */
export function decodeStoresFromUrl(compressed: string): Record<string, unknown> | null {
  try {
    const json = decompressFromEncodedURIComponent(compressed)
    if (!json) return null
    const resolved = resolvePortabilityData(JSON.parse(json), 'share-url')
    return resolved ? resolved.runtimeStores as Record<string, unknown> : null
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
export function applyStoreData(stores: Record<string, unknown>): void {
  const resolved = resolvePortabilityData(stores, 'share-url')
  if (!resolved) return
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
