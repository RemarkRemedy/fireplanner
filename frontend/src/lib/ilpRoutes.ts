const ILP_TOP_LEVEL_ROUTES = new Set([
  '/ilp-review',
  '/ilp-ocf',
  '/ilp-returns',
])

export function isIlpRouteFamily(pathname: string): boolean {
  return pathname.startsWith('/ilp-fees') || ILP_TOP_LEVEL_ROUTES.has(pathname)
}

export function matchesNavPath(pathname: string, itemPath: string): boolean {
  if (itemPath === '/') return pathname === itemPath
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`)
}
