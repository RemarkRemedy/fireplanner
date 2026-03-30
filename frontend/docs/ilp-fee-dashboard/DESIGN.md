# ILP Fee Dashboard Design System

## Product

Consumer-facing Singapore ILP fee investigation tool.

Not a cheerful personal-finance dashboard. Not adviser software. Not generic SaaS.

This product exists to help someone answer uncomfortable questions:

- What am I really paying?
- Do the bonuses actually change the picture?
- If I already bought this, what does exiting cost me?
- Which product variants are structurally worse?

The design has to feel like an independent fee audit. Calm, serious, legible, a little skeptical.

## Current Audit

### What works

- The product already has unusually strong substance. Year-by-year charges, surrender timing, bonus separation, and the detailed table are real differentiators.
- Story mode has emotional contrast and gives the fee number some weight.
- The comparison table is useful immediately.

### What is off

1. The fee product is visually subordinate to the wider FIRE Planner shell.
   The left navigation, expense-tracker banner, footer CTA, and planner chrome compete with the ILP task on every fee route.

2. The fee product speaks in three different visual dialects.
   Landing uses soft pastel marketing cards.
   Compare / exit / review use generic app cards.
   Story mode uses a dramatic dark immersive overlay.

3. Too many bordered boxes.
   The UI often reads as card stacked on card stacked on card. It feels assembled, not authored.

4. The current tone is too polite.
   This is a fee-transparency product. It should feel more like a report, less like a friendly template gallery.

5. The compare and review pages look operational, not editorial.
   They show the right data, but the visual language does not tell the user what matters first.

## Visual Thesis

Editorial watchdog meets analyst workbook.

The first three seconds should feel like this:

"Someone did the work."

"This will show me the number that hurts."

"I can trust this more than a brochure."

## Aesthetic

Industrial-editorial hybrid.

- Editorial for hierarchy, judgment, and point of view.
- Utilitarian for tables, filters, and policy inputs.
- No startup gloss.
- No soft pastel reassurance.
- No faux-premium gradient luxury.

## Decoration

Intentional, restrained.

- Paper-like backgrounds, not flat app white.
- Thin rules, section dividers, score bars.
- Sparse accents with semantic meaning.
- Minimal ornament. Typography and spacing should do most of the work.

## Layout

Hybrid layout.

- Entry surfaces should feel like a report cover or investigative brief.
- Analysis surfaces should feel like a workbook, not a marketing page.
- Use long-form vertical sections, not a sea of equal-weight cards.
- Prefer section headers, summary rails, and evidence blocks over repeated generic cards.

## Color System

Use a warm-paper base with dark ink, then reserve strong colors for meaning.

```css
:root {
  --fd-bg: #f4efe6;
  --fd-surface: #fffdf8;
  --fd-panel: #ece5d8;
  --fd-ink: #0f1724;
  --fd-muted: #5f6877;
  --fd-rule: #d7cfbf;
  --fd-action: #174a7c;
  --fd-fee: #b24a2f;
  --fd-positive: #22624a;
  --fd-warning: #8a6a18;
  --fd-accent-soft: #dce6f2;
}
```

### Color rules

- `--fd-fee` is for gross fees, surrender pain, and warnings. Use it sparingly.
- `--fd-positive` is for bonuses, recovered value, and positive deltas.
- `--fd-action` is for navigation, selected state, and CTAs.
- Neutrals do most of the work.

### Avoid

- default violet gradients
- pale green / blue / lavender card trio patterns
- heavy semantic color on every component

## Typography

Use type to separate "judgment" from "mechanics."

- Display / section verdicts: `Fraunces`
- UI / body / filters / forms: `IBM Plex Sans`
- numeric tables / fine detail: `IBM Plex Mono`

### Why this works

- `Fraunces` gives the product an editorial, report-like point of view.
- `IBM Plex Sans` keeps the interface sharp and serious.
- `IBM Plex Mono` makes fee numbers and tabular comparisons feel deliberate, not decorative.

### Usage rules

- Do not use serif everywhere.
- Serif is for headline judgments, report titles, and narrative section openers.
- Sans is for interface structure.
- Mono is for money, basis labels, drag percentages, and row detail.

## Spacing

8px base unit, medium density.

- tighter than a marketing site
- looser than a trading terminal
- generous vertical rhythm between major report sections
- tighter spacing inside tables and filters

## Motion

Minimal-functional.

- Keep story mode transitions.
- Elsewhere, motion should support comprehension only.
- No decorative hover choreography.
- No floating card feel.

## Core Product Risks

These are the deliberate risks worth taking.

### Risk 1: Break the fee routes out of the planner chrome

Why:
The left rail and planner banners tell the user they are inside a general retirement app. The fee product needs its own authority.

Gain:
The fee dashboard becomes a standalone product with a clear point of view.

Cost:
Some consistency with the rest of the app goes away. That is fine. This is the right trade.

### Risk 2: Replace card soup with report structure

Why:
Equal-weight cards flatten importance. This product needs verdicts, evidence, and drill-downs.

Gain:
The user can tell what matters first.

Cost:
The UI feels less "component-library neat." Good.

### Risk 3: Use warmer, tougher editorial styling

Why:
Pure white + pastel + generic blue CTA reads like template software. A paper-and-ink system feels more investigative.

Gain:
More memorable, more trustworthy, more specific to the job.

Cost:
Less conventionally "safe SaaS." Worth it.

## Safe Choices

These should stay.

- Keep strong tabular legibility.
- Keep semantic green for bonus support and positive deltas.
- Keep the existing year-by-year charts and detailed fee table.
- Keep direct copy. This product is better when it says the uncomfortable thing plainly.

## Page Guidance

## Landing

Should feel like the cover page of a fee report.

- One dominant thesis area.
- One real chart or fee artifact in the hero, not proof chips.
- One primary CTA path, two secondary paths.
- Stronger "why this exists" framing.

Do not use:

- three equal marketing cards as the whole page
- soft product-tour language

## Compare

Should feel like a ranked fee table, almost a public scoreboard.

- Strong sticky filter bar
- Ranked rows with stronger row hierarchy
- Clear visual emphasis on worst fee drag and best exit year
- Less whitespace around the table, more density where the data is

Add:

- row rank
- stronger selected / hovered state
- clearer top summary strip above the table

## Exit

Should feel like a personal case file.

- "Your policy today" briefing block first
- then scenario verdict cards
- then evidence, charts, and table

The current empty-state card is too generic. It needs more gravity and a clearer statement of what the user will learn.

## Review

Should feel like a serious workbench.

- left side: policy rail
- right side: structured analytical document
- template catalog should not dominate the whole page above the fold

The current page front-loads the catalog list too heavily. That makes the product feel like a seed-loader, not an analysis tool.

## Story

Story mode is directionally right, but it should connect visually to the rest of the fee product.

- Keep dark immersive intro for emotional punch.
- After the story closes, transition into the same report language as compare / exit.
- The shift should feel like "headline to evidence."

## Shared Primitives

Build these once and reuse them.

### Report Header

- serif section title
- small mono eyebrow
- short verdict sentence
- optional metadata rail

### Verdict Strip

- one-line judgment
- large number
- short basis label

### Evidence Block

- heading
- explanatory note
- chart or table
- optional "what this means" footer

### Filter Rail

- denser controls
- subtle tinted background
- sticky where useful

### Caution Note

- thin rule
- mono label
- short body copy

## What To Remove

- repetitive rounded cards for every subsection
- pastel triptych layouts
- non-fee FIRE Planner promos inside fee workflows
- footer CTA interruptions inside serious analysis flows

## First Implementation Slices

1. Route-specific fee-dashboard layout
   Remove or reduce planner chrome on `/ilp-fees`, `/ilp-fees/compare`, `/ilp-fees/exit`, `/ilp-fees/story/*`, and likely `/ilp-review`.

2. Shared fee-dashboard tokens
   Add route-scoped typography, color, spacing, and section-header primitives.

3. Compare page restyle
   Turn it into the canonical report table surface. This is the strongest functional page and should define the tone.

4. Exit page restyle
   Make it feel like a serious decision file, not a standard form-and-card flow.

5. Landing rewrite
   Rebuild around thesis + evidence + path choice, not three equal pastel boxes.

6. Review page restructure
   Promote policy workbench, demote template catalog.

## Non-Goals

- Do not make this look like a crypto terminal.
- Do not make it feel like a luxury insurer microsite.
- Do not use faux-legal blackletter seriousness.
- Do not optimize for startup-dribbble polish.

## One-Line Standard

If a screen looks like it could also be a generic budgeting app, it failed.
