# NotebookLM Embed Widget — Design Spec

## Overview

A floating chat-style widget for the ILP fee dashboard that embeds a Google NotebookLM chatbot via iframe, with graceful fallback when iframe embedding is blocked (which is the expected case). The widget provides users with an AI-powered product guide for ILP fees, premiums, and fund options.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Hybrid Radix Dialog/Sheet | `modal={false}` on desktop for chat-widget feel, Sheet on mobile for full-screen. Accessibility built in. |
| Scope | ILP fee dashboard page only | Mounted in the dashboard page component, not root layout |
| Position | Bottom-right, stacked above FeedbackFab | Button at `bottom-24 right-6` (96px up), FeedbackFab stays at `bottom-6 right-6` |
| Primary color | Site blue (CSS `--primary`) | Configurable via `primaryColor` prop |
| File structure | 3 components + barrel export | Adapted from spec's 6-file structure to use existing primitives |
| Styling | Tailwind + existing CSS variables | Dark mode automatic via `bg-background`/`text-foreground` |
| Icons | lucide-react | Existing dependency, no inline SVGs |
| Animation | framer-motion | Existing dependency, respects `prefers-reduced-motion` |
| Analytics | Umami via `trackEvent()` | Existing integration, 5 new event types |

## Component Architecture

### File Structure

```
frontend/src/components/ilp/NotebookWidget/
├── NotebookWidget.tsx      # Container: floating button, panel shell, open/close state
├── NotebookIframe.tsx      # Iframe loader with timeout-based fallback detection
├── NotebookFallback.tsx    # Styled fallback card with "Open in new tab" CTA
└── index.ts                # Re-export
```

### Reused Primitives

- `Button` from `components/ui/button`
- `Sheet` + `SheetContent` from `components/ui/sheet` (mobile panel)
- `useMediaQuery` hook (desktop vs mobile breakpoint)
- `cn()` utility from `lib/utils`
- `lucide-react`: `MessageCircle`, `X`, `Minus`, `ExternalLink`
- `framer-motion`: `AnimatePresence`, `motion.div`
- `trackEvent()` from `lib/analytics.ts`

## Props Interface

```typescript
interface NotebookWidgetProps {
  notebookUrl: string
  title?: string              // default: "Product Guide"
  subtitle?: string           // fallback description text, default: "Chat with our AI-powered product guide to learn about premiums, fees, fund options, and more."
  buttonLabel?: string        // tooltip text, default: "Ask about our products"
  primaryColor?: string       // accent override, default: CSS --primary
  position?: 'bottom-right' | 'bottom-left'  // default: 'bottom-right'
  defaultOpen?: boolean       // default: false
  delayMs?: number            // button entrance delay, default: 2000
}
```

## State Machine

### Widget States

```
closed → open → dismissed
```

- **closed**: Floating button visible. Appears after `delayMs` with scale+fade entrance animation.
- **open**: Panel expanded. Iframe loading attempted.
- **dismissed**: User clicked X. Button hidden for rest of page session. Not persisted to localStorage; resets on navigation/reload.

### Iframe States (internal to NotebookIframe)

```
loading → success (Mode A) | fallback (Mode B)
```

**Detection sequence:**
1. Render iframe with `src={notebookUrl}`, show spinner overlay.
2. After 3 seconds, hide spinner to let iframe paint.
3. Listen for `load` event. If fired, mark `success`.
4. After 5 seconds total with no `load` event, switch to `fallback`.
5. On `error` event, immediately switch to `fallback`.
6. In Mode A, always show "Not loading? Open in new tab" link below iframe as safety net.

## Behavior

### Floating Button

- 56px circle (`h-14 w-14 rounded-full`)
- `bg-primary text-primary-foreground` (overridable via `primaryColor` inline style)
- `shadow-lg` for depth
- `title` attribute for tooltip: "Ask about our products"
- Entrance: framer-motion `scale: [0, 1]` + `opacity: [0, 1]` after `delayMs`
- Position: `fixed bottom-24 right-6` (stacks above FeedbackFab at `bottom-6 right-6`)
- `z-[9999]`

### Desktop Panel

- Radix Dialog with `modal={false}` (no backdrop, no body scroll lock, no focus trap)
- 420px wide, 620px tall
- Anchored bottom-right, above the floating button
- `rounded-2xl shadow-xl bg-background`
- framer-motion slide-up animation (300ms ease-out)
- Header: `bg-primary/5` tinted bar, icon + title + minimize (returns to button) + close (dismisses)
- Body: iframe (Mode A) or fallback card (Mode B)
- Footer: "Powered by Google NotebookLM" in `text-muted-foreground`

### Mobile Panel

- Radix Sheet from bottom, full-screen
- Switched via `useMediaQuery('(min-width: 768px)')`
- Close button prominent at top-right
- Same body/footer content as desktop

### Keyboard & Accessibility

- Escape closes panel (Radix native)
- Mobile Sheet focus trap (Radix native)
- Desktop `modal={false}` allows interaction with page behind widget
- `aria-label` on floating button: "Open product guide chat"
- `aria-label` on close button: "Close product guide"
- iframe `title`: "Product Guide - NotebookLM"
- `prefers-reduced-motion`: skip entrance animation, instant open/close

## Styling

### Dark Mode

Automatic via existing CSS variables. No custom dark mode code needed:
- `bg-background` resolves to dark surface
- `text-foreground` resolves to light text
- `border` resolves to dark borders

### Custom primaryColor

When provided, applied as inline `style={{ backgroundColor: primaryColor }}` on the floating button and as accent in the header bar. Otherwise inherits from CSS variable `--primary`.

## Analytics Events

5 new events added to `AnalyticsEvent` union in `lib/analytics.ts`:

| Event | Trigger |
|-------|---------|
| `notebook_widget_opened` | User clicks floating button |
| `notebook_widget_closed` | User closes or minimizes panel |
| `notebook_iframe_loaded` | Iframe Mode A success |
| `notebook_iframe_fallback` | Iframe Mode B fallback triggered |
| `notebook_external_opened` | User clicks "Open in new tab" |

## Integration

Rendered inside the ILP fee dashboard page component:

```tsx
import { NotebookWidget } from '@/components/ilp/NotebookWidget'

<NotebookWidget
  notebookUrl="https://notebooklm.google.com/notebook/53f9afd2-8845-4f36-a1d3-d7d768942dc4/preview"
  title="Product Guide"
/>
```

## Not Building (YAGNI)

- No localStorage persistence for open/close state
- No `onOpen`/`onClose` callback props
- No custom icon prop
- No animation duration props (300ms hardcoded)
- No `icons.tsx` file (using lucide-react)
- No CSS modules (using Tailwind)
- No console.log fallback for analytics (using existing Umami)
