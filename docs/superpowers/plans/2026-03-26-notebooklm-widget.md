# NotebookLM Embed Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating chat-style widget to the ILP fee dashboard that attempts to embed a Google NotebookLM chatbot via iframe, with graceful fallback when embedding is blocked.

**Architecture:** Three components in `components/ilp/NotebookWidget/`. `NotebookWidget` owns open/close lifecycle and renders a framer-motion panel on desktop or Radix Sheet on mobile. `NotebookIframe` handles iframe load detection with timeouts. `NotebookFallback` provides a styled CTA when iframe is blocked. Analytics via existing Umami `trackEvent()`.

**Tech Stack:** React, TypeScript, Tailwind CSS, framer-motion, Radix Sheet, lucide-react, Umami analytics

**Branch:** Create worktree from `feat/ilp-fee-dashboard`

**Spec:** `docs/superpowers/specs/2026-03-26-notebooklm-widget-design.md`

**Deviations from spec:**
- **z-index:** Spec says `z-[9999]`; plan uses `z-50` (above FeedbackFab's `z-40`, consistent with codebase's Radix portal convention).
- **Desktop panel:** Spec says "Radix Dialog with `modal={false}`"; plan uses a plain `motion.div` with `role="dialog"` + manual Escape key handler. Pragmatic: `modal={false}` disables all Dialog features (backdrop, focus trap, scroll lock), so wrapping in Radix Dialog adds boilerplate with no benefit.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `frontend/src/lib/analytics.ts` | Add 5 notebook widget event types to `AnalyticsEvent` union |
| Create | `frontend/src/components/ilp/NotebookWidget/NotebookFallback.tsx` | Styled fallback card with "Open in new tab" CTA |
| Create | `frontend/src/components/ilp/NotebookWidget/NotebookIframe.tsx` | Iframe loader with 3s spinner, 5s timeout fallback detection |
| Create | `frontend/src/components/ilp/NotebookWidget/NotebookWidget.tsx` | Main container: floating button, desktop panel, mobile Sheet |
| Create | `frontend/src/components/ilp/NotebookWidget/index.ts` | Barrel export |
| Modify | `frontend/src/pages/IlpLeaderboardPage.tsx` | Import and render `<NotebookWidget>` |

---

### Task 1: Add Analytics Event Types

**Files:**
- Modify: `frontend/src/lib/analytics.ts` (the `AnalyticsEvent` union type)

- [ ] **Step 1: Add notebook widget events to AnalyticsEvent union**

Open `frontend/src/lib/analytics.ts`. Find the `AnalyticsEvent` type union (starts around line 13). Add these 5 events at the end of the union, before the closing semicolon:

```typescript
  | 'notebook_widget_opened'
  | 'notebook_widget_closed'
  | 'notebook_iframe_loaded'
  | 'notebook_iframe_fallback'
  | 'notebook_external_opened'
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/analytics.ts
git commit -m "feat: add notebook widget analytics event types"
```

---

### Task 2: Create NotebookFallback Component

**Files:**
- Create: `frontend/src/components/ilp/NotebookWidget/NotebookFallback.tsx`

- [ ] **Step 1: Create the NotebookFallback component**

Create `frontend/src/components/ilp/NotebookWidget/NotebookFallback.tsx`:

```tsx
import { ExternalLink, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface NotebookFallbackProps {
  notebookUrl: string
  subtitle: string
  onExternalOpen: () => void
}

export function NotebookFallback({
  notebookUrl,
  subtitle,
  onExternalOpen,
}: NotebookFallbackProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="h-8 w-8 text-primary" />
      </div>
      <p className="max-w-[280px] text-sm leading-relaxed text-muted-foreground">
        {subtitle}
      </p>
      <Button
        onClick={() => {
          window.open(notebookUrl, '_blank', 'noopener,noreferrer')
          onExternalOpen()
        }}
        className="gap-2"
      >
        Open Product Guide
        <ExternalLink className="h-4 w-4" />
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors. The component has no imports from other new files, so it should compile standalone.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ilp/NotebookWidget/NotebookFallback.tsx
git commit -m "feat: add NotebookFallback component for blocked iframe CTA"
```

---

### Task 3: Create NotebookIframe Component

**Files:**
- Create: `frontend/src/components/ilp/NotebookWidget/NotebookIframe.tsx`

- [ ] **Step 1: Create the NotebookIframe component**

Create `frontend/src/components/ilp/NotebookWidget/NotebookIframe.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type IframeState = 'loading' | 'success' | 'fallback'

interface NotebookIframeProps {
  notebookUrl: string
  title: string
  onStateChange: (state: 'success' | 'fallback') => void
}

export function NotebookIframe({
  notebookUrl,
  title,
  onStateChange,
}: NotebookIframeProps) {
  const [state, setState] = useState<IframeState>('loading')
  const [showSpinner, setShowSpinner] = useState(true)
  const hasTransitioned = useRef(false)

  useEffect(() => {
    const spinnerTimer = setTimeout(() => setShowSpinner(false), 3000)

    const fallbackTimer = setTimeout(() => {
      if (!hasTransitioned.current) {
        hasTransitioned.current = true
        setState('fallback')
        onStateChange('fallback')
      }
    }, 5000)

    return () => {
      clearTimeout(spinnerTimer)
      clearTimeout(fallbackTimer)
    }
  }, [onStateChange])

  const handleLoad = () => {
    if (!hasTransitioned.current) {
      hasTransitioned.current = true
      setState('success')
      setShowSpinner(false)
      onStateChange('success')
    }
  }

  const handleError = () => {
    if (!hasTransitioned.current) {
      hasTransitioned.current = true
      setState('fallback')
      setShowSpinner(false)
      onStateChange('fallback')
    }
  }

  // Parent switches to NotebookFallback when iframeMode === 'fallback'
  if (state === 'fallback') return null

  return (
    <div className="relative flex flex-1 flex-col">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <iframe
        src={notebookUrl}
        title={`${title} - NotebookLM`}
        className={cn(
          'flex-1 border-0',
          state === 'loading' && !showSpinner && 'opacity-80'
        )}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        onLoad={handleLoad}
        onError={handleError}
      />
      <div className="px-4 py-1.5 text-center">
        <a
          href={notebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Not loading? Open in new tab
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
```

**Key implementation notes for the agent:**
- `hasTransitioned` ref prevents double-firing (both load event and timeout racing).
- `onStateChange` is in the deps array but is stable (parent wraps it in `useCallback([], [])`), so the effect runs once on mount.
- `sandbox` attribute restricts the iframe's capabilities while allowing NotebookLM to function.
- When `state === 'fallback'`, this component returns `null`. The parent (`NotebookWidget`) checks its own `iframeMode` state and renders `NotebookFallback` instead.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ilp/NotebookWidget/NotebookIframe.tsx
git commit -m "feat: add NotebookIframe with timeout-based fallback detection"
```

---

### Task 4: Create NotebookWidget Component + Barrel Export

**Files:**
- Create: `frontend/src/components/ilp/NotebookWidget/NotebookWidget.tsx`
- Create: `frontend/src/components/ilp/NotebookWidget/index.ts`

- [ ] **Step 1: Create the main NotebookWidget component**

Create `frontend/src/components/ilp/NotebookWidget/NotebookWidget.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, Minus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'
import { NotebookIframe } from './NotebookIframe'
import { NotebookFallback } from './NotebookFallback'

interface NotebookWidgetProps {
  notebookUrl: string
  title?: string
  subtitle?: string
  buttonLabel?: string
  primaryColor?: string
  position?: 'bottom-right' | 'bottom-left'
  defaultOpen?: boolean
  delayMs?: number
}

type WidgetState = 'closed' | 'open' | 'dismissed'
type IframeMode = 'loading' | 'success' | 'fallback'

export function NotebookWidget({
  notebookUrl,
  title = 'Product Guide',
  subtitle = 'Chat with our AI-powered product guide to learn about premiums, fees, fund options, and more.',
  buttonLabel = 'Ask about our products',
  primaryColor,
  position = 'bottom-right',
  defaultOpen = false,
  delayMs = 2000,
}: NotebookWidgetProps) {
  const [widgetState, setWidgetState] = useState<WidgetState>(
    defaultOpen ? 'open' : 'closed'
  )
  const [showButton, setShowButton] = useState(defaultOpen)
  const [iframeMode, setIframeMode] = useState<IframeMode>('loading')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const shouldReduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Delay button entrance
  useEffect(() => {
    if (defaultOpen) return
    const timer = setTimeout(() => setShowButton(true), delayMs)
    return () => clearTimeout(timer)
  }, [delayMs, defaultOpen])

  // Escape key handler for desktop panel
  useEffect(() => {
    if (widgetState !== 'open' || !isDesktop) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setWidgetState('closed')
        trackEvent('notebook_widget_closed')
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [widgetState, isDesktop])

  const handleOpen = useCallback(() => {
    setWidgetState('open')
    trackEvent('notebook_widget_opened')
  }, [])

  const handleMinimize = useCallback(() => {
    setWidgetState('closed')
    trackEvent('notebook_widget_closed')
  }, [])

  const handleDismiss = useCallback(() => {
    setWidgetState('dismissed')
    trackEvent('notebook_widget_closed')
  }, [])

  const handleIframeStateChange = useCallback(
    (state: 'success' | 'fallback') => {
      setIframeMode(state)
      trackEvent(
        state === 'success'
          ? 'notebook_iframe_loaded'
          : 'notebook_iframe_fallback'
      )
    },
    []
  )

  const handleExternalOpen = useCallback(() => {
    trackEvent('notebook_external_opened')
  }, [])

  if (widgetState === 'dismissed') return null

  const isLeft = position === 'bottom-left'
  const positionClasses = isLeft ? 'left-4 md:left-6' : 'right-4 md:right-6'

  const panelBody =
    iframeMode !== 'fallback' ? (
      <NotebookIframe
        notebookUrl={notebookUrl}
        title={title}
        onStateChange={handleIframeStateChange}
      />
    ) : (
      <NotebookFallback
        notebookUrl={notebookUrl}
        subtitle={subtitle}
        onExternalOpen={handleExternalOpen}
      />
    )

  const panelFooter = (
    <div className="border-t px-4 py-2 text-center">
      <span className="text-[10px] text-muted-foreground">
        Powered by Google NotebookLM
      </span>
      {!isDesktop && (
        <button
          onClick={handleDismiss}
          className="mt-1 block w-full text-[10px] text-muted-foreground underline hover:text-foreground"
        >
          Don't show again
        </button>
      )}
    </div>
  )

  const panelHeader = (
    <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleMinimize}
          aria-label="Minimize product guide"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleDismiss}
          aria-label="Close product guide"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {showButton && widgetState === 'closed' && (
          <motion.div
            key="notebook-fab"
            initial={
              shouldReduceMotion ? { opacity: 1 } : { scale: 0, opacity: 0 }
            }
            animate={{ scale: 1, opacity: 1 }}
            exit={
              shouldReduceMotion ? { opacity: 0 } : { scale: 0, opacity: 0 }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.3,
              ease: 'easeOut',
            }}
            className={cn(
              'fixed z-50 bottom-[13.5rem] md:bottom-24',
              positionClasses
            )}
          >
            <Button
              onClick={handleOpen}
              className="h-14 w-14 rounded-full shadow-lg"
              style={
                primaryColor ? { backgroundColor: primaryColor } : undefined
              }
              title={buttonLabel}
              aria-label="Open product guide chat"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Panel */}
      <AnimatePresence>
        {isDesktop && widgetState === 'open' && (
          <motion.div
            key="notebook-panel"
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { y: 20, opacity: 0 }
            }
            animate={{ y: 0, opacity: 1 }}
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : { y: 20, opacity: 0 }
            }
            transition={{
              duration: shouldReduceMotion ? 0 : 0.3,
              ease: 'easeOut',
            }}
            className={cn(
              'fixed z-50 bottom-6 flex flex-col',
              'h-[620px] w-[420px]',
              'overflow-hidden rounded-2xl border bg-background shadow-xl',
              positionClasses
            )}
            role="dialog"
            aria-label={title}
          >
            {panelHeader}
            {panelBody}
            {panelFooter}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Sheet */}
      {!isDesktop && (
        <Sheet
          open={widgetState === 'open'}
          onOpenChange={(open) => {
            if (!open) handleMinimize()
          }}
        >
          <SheetContent
            side="bottom"
            className="flex h-[calc(100vh-20px)] flex-col rounded-t-xl p-0"
          >
            <SheetHeader className="border-b bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <SheetTitle>{title}</SheetTitle>
              </div>
            </SheetHeader>
            {panelBody}
            {panelFooter}
          </SheetContent>
        </Sheet>
      )}
    </>
  )
}
```

**Key implementation notes for the agent:**
- **Positioning:** Floating button at `bottom-[13.5rem]` mobile / `bottom-24` desktop to stack above existing mobile FABs (Help FAB at `bottom-16`, Share FAB at `bottom-28`, both `md:hidden`). Desktop panel at `bottom-6` since no competing fixed elements exist on desktop.
- **AnimatePresence keys:** `notebook-fab` and `notebook-panel` keys are required for framer-motion to track mount/unmount for exit animations.
- **iframeMode persists across open/close:** If the iframe failed once, reopening the panel shows the fallback directly without re-attempting.
- **Desktop uses `role="dialog"` + Escape key handler** instead of Radix Dialog. This avoids the backdrop and focus trap while maintaining accessibility. Mobile uses Radix Sheet which provides focus trap and overlay natively.
- **`shouldReduceMotion`:** Uses the codebase's established `useMediaQuery('(prefers-reduced-motion: reduce)')` pattern (not framer-motion's `useReducedMotion`). When true, animations use `duration: 0` for instant transitions.
- **Mobile Sheet:** Does NOT render a custom X button — `SheetContent` already renders a built-in `<SheetPrimitive.Close>` at top-right. "Don't show again" link in footer handles permanent dismissal.

- [ ] **Step 2: Create the barrel export**

Create `frontend/src/components/ilp/NotebookWidget/index.ts`:

```typescript
export { NotebookWidget } from './NotebookWidget'
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new errors. All three components should compile together.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ilp/NotebookWidget/
git commit -m "feat: add NotebookWidget with floating button, desktop panel, and mobile sheet"
```

---

### Task 5: Integrate into ILP Fee Dashboard Page

**Files:**
- Modify: `frontend/src/pages/IlpLeaderboardPage.tsx`

- [ ] **Step 1: Read the current IlpLeaderboardPage**

Open `frontend/src/pages/IlpLeaderboardPage.tsx` and locate:
1. The import block at the top of the file
2. The closing `</>` or final `</div>` of the component's JSX return

- [ ] **Step 2: Add the NotebookWidget import**

Add this import alongside the existing component imports:

```typescript
import { NotebookWidget } from '@/components/ilp/NotebookWidget'
```

- [ ] **Step 3: Add the NotebookWidget to the JSX**

Just before the component's closing fragment (`</>`) or final closing tag, add:

```tsx
<NotebookWidget
  notebookUrl="https://notebooklm.google.com/notebook/53f9afd2-8845-4f36-a1d3-d7d768942dc4/preview"
  title="Product Guide"
/>
```

Since the widget uses `fixed` positioning, placement in the JSX tree doesn't matter visually. Put it at the end of the return for clarity.

- [ ] **Step 4: Type-check and lint**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/IlpLeaderboardPage.tsx
git commit -m "feat: integrate NotebookWidget into ILP fee dashboard page"
```

---

### Task 6: Build Verification and Manual QA

- [ ] **Step 1: Run full build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and verify**

Run: `cd frontend && npm run dev -- --port 5173`

Navigate to the ILP fee dashboard page (likely `/ilp/compare`) and verify:

1. Widget button appears after 2-second delay with smooth animation
2. Clicking button opens panel with slide-up animation
3. Iframe loading spinner shows for ~3 seconds
4. After ~5 seconds, fallback card appears (Google blocks iframe embedding)
5. "Open in new tab" button works and opens the NotebookLM URL
6. "Not loading?" link is visible during iframe loading phase
7. Minimize button (—) closes panel, button reappears
8. Close button (X) dismisses widget entirely (button and panel gone)
9. Escape key closes the panel on desktop
10. Dark mode toggle: widget colors adapt correctly
11. Resize to mobile width: panel becomes full-screen Sheet
12. Multiple open/close cycles don't break anything
13. No console errors

- [ ] **Step 3: Verify FeedbackFab coexistence**

Confirm both the NotebookWidget button and FeedbackFab are visible simultaneously without overlap. The NotebookWidget button should be stacked above the FeedbackFab.
