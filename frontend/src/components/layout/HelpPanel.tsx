import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X, ExternalLink, GripVertical } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/stores/useUIStore'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { useActiveSection } from '@/hooks/useActiveSection'
import { HELP_FAQ } from '@/lib/data/helpContent'
import { getSourcesForRoute } from '@/lib/data/sources'

const DEFAULT_WIDTH = 380
const MIN_WIDTH = 280
const MAX_WIDTH = 600

export function HelpPanel({ mobile = false }: { mobile?: boolean }) {
  const { pathname } = useLocation()
  const normalizedPathname = pathname === '/planner' ? '/stress-test' : pathname
  const { activeSection } = useActiveSection()
  const toggleHelpPanel = useUIStore((s) => s.toggleHelpPanel)
  const statsPosition = useUIStore((s) => s.statsPosition)
  const isOverlay = useMediaQuery('(max-width: 1100px)')

  // When stats strip is fixed at the bottom on stats routes, add padding so content isn't hidden
  const STATS_ROUTES = ['/inputs', '/projection', '/stress-test', '/planner', '/dashboard']
  const needsBottomPad = statsPosition === 'bottom' && STATS_ROUTES.includes(pathname)
  const [width, setWidth] = useState(DEFAULT_WIDTH)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Use section-specific content when on /inputs with an active section,
  // otherwise fall back to route-level content
  const contentKey = activeSection ?? normalizedPathname
  const faqItems = HELP_FAQ[contentKey] ?? HELP_FAQ[normalizedPathname] ?? []
  const sources = getSourcesForRoute(contentKey)

  // Friendly label matching sidebar capitalisation (FIRE, CPF are acronyms)
  const SECTION_LABELS: Record<string, string> = {
    'section-personal': 'Personal',
    'section-fire-settings': 'FIRE Settings',
    'section-income': 'Income',
    'section-expenses': 'Expenses',
    'section-net-worth': 'Net Worth',
    'section-cpf': 'CPF',
    'section-healthcare': 'Healthcare',
    'section-property': 'Property',
    'section-allocation': 'Allocation',
  }
  const sectionLabel = activeSection ? (SECTION_LABELS[activeSection] ?? null) : null

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = startX.current - e.clientX
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta))
      setWidth(newWidth)
    }

    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  if (mobile) {
    return (
      <div className="flex flex-col w-full">
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          {faqItems.length > 0 ? (
            <Accordion key={contentKey} type="multiple" className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem key={`${contentKey}-${i}`} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">No help content for this page.</p>
          )}

          {/* Data Sources */}
          {sources.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Data Sources
              </h3>
              <ul className="space-y-1.5">
                {sources.map((src, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {src.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="ml-1 text-muted-foreground/60">({src.period})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'h-full flex',
        isOverlay
          ? 'absolute right-0 top-0 z-20 shadow-[-4px_0_16px_rgba(0,0,0,0.1)]'
          : 'shrink-0'
      )}
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1.5 shrink-0 cursor-col-resize bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors flex items-center justify-center group"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      </div>

      {/* Panel content */}
      <div className={cn('flex-1 min-w-0 h-full flex flex-col', isOverlay ? 'bg-background' : 'bg-muted')}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Help</h2>
            {sectionLabel && (
              <p className="text-xs text-muted-foreground truncate">{sectionLabel}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={toggleHelpPanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden px-4 py-3', needsBottomPad && 'pb-12')}>
          {faqItems.length > 0 ? (
            <Accordion key={contentKey} type="multiple" className="w-full">
              {faqItems.map((item, i) => (
                <AccordionItem key={`${contentKey}-${i}`} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm text-left">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <p className="text-sm text-muted-foreground">No help content for this page.</p>
          )}

          {/* Data Sources */}
          {sources.length > 0 && (
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Data Sources
              </h3>
              <ul className="space-y-1.5">
                {sources.map((src, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {src.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span className="ml-1 text-muted-foreground/60">({src.period})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
