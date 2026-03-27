# FirePlanner Design Research

**Date:** 2026-03-27
**Status:** Research (not yet accepted as DESIGN.md)
**Source:** /design-consultation session with 3 AI models + competitive analysis

## Current Design System (Inferred from Codebase)

### Color System (from `src/index.css` CSS variables)

**Light mode:**
| Role | HSL | Hex (approx) | Usage |
|------|-----|-------------|-------|
| Background | 210 20% 99% | `#FCFCFD` | Page background |
| Foreground | 222.2 84% 4.9% | `#0A0F1A` | Primary text |
| Card | 0 0% 100% | `#FFFFFF` | Card surfaces |
| Primary | 221.2 83.2% 53.3% | `#3B82F6` | Blue accent, links, CTAs, input borders |
| Secondary | 210 40% 96.1% | `#EFF3F8` | Secondary backgrounds |
| Muted | 210 40% 96.1% | `#EFF3F8` | Muted backgrounds |
| Muted fg | 215.4 16.3% 42% | `#5B6577` | Muted text, descriptions |
| Destructive | 0 84.2% 60.2% | `#EF4444` | Error states |
| Success | 142 71% 45% | `#22C55E` | Green, linked values, completion |
| Warning | 38 92% 50% | `#F59E0B` | Amber, beta banner |
| Border | 214.3 31.8% 91.4% | `#E2E8F0` | Card borders, dividers |
| Ring | 221.2 83.2% 53.3% | `#3B82F6` | Focus rings (same as primary) |
| Radius | 0.5rem (8px) | | Default border radius |

**Dark mode:** Full dark mode variables defined in `.dark` class.

**Chart colors:** Dedicated chart palette for strategies, fan charts, and semantic data visualization.

### Color Conventions (from CLAUDE.md)
- **Blue border** = user input field
- **Black text** = formula/computed value
- **Green text** = linked from another store/section

### Typography
- **Current:** Default Tailwind/shadcn font stack (system sans-serif)
- **No custom fonts loaded** (no Google Fonts, no self-hosted)
- Headings: bold, various sizes
- Data/numbers: same font stack (no monospace for data currently)

### Layout
- **Sidebar:** Left sidebar (~230px) with navigation sections (START, INPUTS, PLAN)
- **Main content:** Scrollable, max-width constrained
- **Cards:** White with light border, `CardHeader` + `CardContent pt-0` pattern
- **Status bar:** Fixed bottom bar showing FIRE Age, Years to FIRE, FIRE Number, Progress
- **Landing page:** No sidebar, full-width, centered content

### Component Patterns
- Inputs: `CurrencyInput`, `NumberInput`, `PercentInput` (shared wrappers)
- Cards: shadcn `Card/CardHeader/CardContent/CardTitle`
- Buttons: shadcn `Button` with variant system
- Tables: Clean, minimal horizontal borders, header uppercase
- Banners: `BetaBanner` (amber), `DataUpdateBanner` (blue), contextual nudges
- Toggle groups: Used for plan type (Individual/Couple/Household)
- Simple/Advanced toggle: Top of sidebar

### Spacing
- Base unit: Tailwind default (4px)
- Content padding: `px-6` or `px-8` (24-32px)
- Card gap: `gap-4` to `gap-6` (16-24px)
- Section spacing: `mt-8` to `mt-12` (32-48px)

## Competitive Analysis (March 2026)

### Screenshots captured
- ProjectionLab (`projectionlab.com`): Clean white, teal accent on "You Love.", product-led hero showing the actual chart tool
- Endowus (`endowus.com`): Corporate SG fintech, "Invest with clarity" serif italic hero, navy sections, photo of person, $18M counter
- StashAway (`stashaway.sg`): "The smarter way to invest and save", navy + white, phone mockups, $340 welcome reward promo

### Category convergence
Every SG fintech tool shares: blue primary, white backgrounds, clean sans-serif, trust badges (MAS regulated), "get started free" CTA. The look is interchangeable.

### Differentiation opportunity
FirePlanner is NOT selling managed investments. It's a free calculator. The design should signal "tool" not "pitch." ProjectionLab's approach (show the tool in the hero) is closest to right.

## Three Design Directions Explored

### Direction A: "Financial Times Simulator" (Codex/GPT-5.4)
- Visual thesis: "A civic-modern planning instrument: warm paper, dark ink, restrained data-green"
- Background: `#F4F0E8` (warm paper)
- Accent: `#0F766E` (mineral teal)
- Display: Fraunces (serif), Body: Manrope, Data: IBM Plex Mono
- Mood: "The Financial Times designed a Singapore retirement simulator"
- Key departure: paper background (not white), teal accent (not blue), editorial layout (left-weighted, asymmetric)
- Risk level: Medium

### Direction B: "Government Nerd Gone Rogue" (Claude subagent)
- Visual thesis: "Singapore Planning Department internal dashboard crossed with a zine made by a former GIC quant"
- Background: `#F5F2EC` (bone white)
- Accent: `#C6F135` (acid chartreuse)
- Display: DM Mono, Body: Space Grotesk, Data: JetBrains Mono
- Mood: "Mild alarm, then relief. This does not look like every other SG fintech."
- Key departure: monospaced display type, chartreuse accent, lowercase UI labels, dot-matrix chart aesthetic
- Risk level: High

### Direction C: Hybrid (recommended by Claude main)
- Codex's palette (teal + warm paper) with subagent's monospaced number moments (DM Mono for big FIRE numbers, Fraunces for hero headlines)
- Chartreuse as secondary highlight only (not primary accent)
- Risk level: Medium-low

### Three-model agreement
All three models independently rejected blue as primary accent and recommended warm/paper backgrounds, monospaced data fonts, product-forward landing, and editorial (not centered SaaS) layout.

## Assessment: Current Design vs Proposed Directions

The current design (white + blue + system fonts + shadcn) is functional and clean. It doesn't need a redesign to ship the referral program or any near-term features. The directions explored represent a future evolution opportunity, not an urgent change.

**If adopted, the biggest impact would be:**
1. Warm paper background (instead of pure white) for reduced eye strain and distinct visual identity
2. Monospaced font for data/numbers (IBM Plex Mono or JetBrains Mono) for a more "tool-like" feel
3. Custom display font (Fraunces or similar) for hero moments only
4. Teal accent as a replacement for blue (differentiates from every SG fintech competitor)

**What to preserve regardless:**
- Blue border = user input convention (deeply embedded in CLAUDE.md and user expectations)
- shadcn/ui component system
- Sidebar + main content layout
- Card-based organization for form sections
- Status bar with FIRE metrics
