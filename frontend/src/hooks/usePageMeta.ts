import { useEffect } from 'react'

const BASE_URL = 'https://sgfireplanner.com'

interface PageMeta {
  title: string
  description?: string
  /** Route path, e.g. '/reference'. Defaults to '/' */
  path?: string
}

function setMetaContent(selector: string, content: string): string {
  const el = document.querySelector(selector)
  if (!el) return ''
  const prev = el.getAttribute('content') ?? ''
  el.setAttribute('content', content)
  return prev
}

/** Page name lookup for breadcrumb labels (path → display name) */
const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/inputs': 'Inputs',
  '/projection': 'Projection',
  '/withdrawal': 'Withdrawal Strategies',
  '/stress-test': 'Stress Test',
  '/health-check': 'Health Check',
  '/dashboard': 'Dashboard',
  '/reference': 'Reference Guide',
  '/checklist': 'FIRE Checklist',
  '/privacy': 'Privacy Policy',
  '/retirement-planner': 'Retirement Planner',
  '/retirement-calculator': 'Retirement Calculator',
  '/quick-estimate': 'Quick Estimate',
}

export function usePageMeta({ title, description, path = '/' }: PageMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = title

    const canonicalUrl = `${BASE_URL}${path}`

    // Description
    let prevDesc = ''
    if (description) {
      prevDesc = setMetaContent('meta[name="description"]', description)
    }

    // Canonical
    const canonicalEl = document.querySelector('link[rel="canonical"]')
    const prevCanonical = canonicalEl?.getAttribute('href') ?? ''
    canonicalEl?.setAttribute('href', canonicalUrl)

    // Open Graph
    const prevOgTitle = setMetaContent('meta[property="og:title"]', title)
    const prevOgDesc = description
      ? setMetaContent('meta[property="og:description"]', description)
      : ''
    const prevOgUrl = setMetaContent('meta[property="og:url"]', canonicalUrl)

    // Twitter
    const prevTwitterTitle = setMetaContent('meta[name="twitter:title"]', title)
    const prevTwitterDesc = description
      ? setMetaContent('meta[name="twitter:description"]', description)
      : ''

    // BreadcrumbList structured data
    const breadcrumbItems = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL + '/' },
    ]
    if (path !== '/') {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: 2,
        name: PAGE_NAMES[path] ?? title.split(/[—:]/)[0].trim(),
        item: canonicalUrl,
      })
    }
    const breadcrumbScript = document.createElement('script')
    breadcrumbScript.type = 'application/ld+json'
    breadcrumbScript.setAttribute('data-page-meta', 'breadcrumb')
    breadcrumbScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbItems,
    })
    document.head.appendChild(breadcrumbScript)

    return () => {
      document.title = prevTitle
      if (description) {
        setMetaContent('meta[name="description"]', prevDesc)
        setMetaContent('meta[property="og:description"]', prevOgDesc)
        setMetaContent('meta[name="twitter:description"]', prevTwitterDesc)
      }
      canonicalEl?.setAttribute('href', prevCanonical)
      setMetaContent('meta[property="og:title"]', prevOgTitle)
      setMetaContent('meta[property="og:url"]', prevOgUrl)
      setMetaContent('meta[name="twitter:title"]', prevTwitterTitle)
      document.head.removeChild(breadcrumbScript)
    }
  }, [title, description, path])
}
