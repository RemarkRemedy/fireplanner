# Goal Calculator Design Review Report

**Date:** 2026-03-26
**Branch:** `feat/goal-calculator`
**URL:** `http://localhost:5173/goal-calculator`
**Reviewer:** Claude (automated design review)

## Summary

The goal calculator is a 4-step flow (Pick > Configure > Basics > Results) targeting fresh university graduates. The feature is **visually solid for V1 launch**. All critical design issues have been fixed. Three low-priority enhancements are deferred.

## Pages Reviewed

| Step | Component | Desktop | Mobile (375px) |
|------|-----------|---------|----------------|
| 1. GoalPicker | 9-tile grid | 3-col, centered | 2-col, responsive |
| 2. GoalConfig (smart) | HDB/Condo/Car form | Single card, well-structured | Stacks naturally |
| 3. BasicsForm | 4-field form | Clean, defaults populated | Full-width inputs |
| 4. Results | Goal cards + actions | Cards with badges, progress bars | Stacks, buttons full-width |

## Findings

### Fixed (4 issues)

| ID | Severity | Finding | Fix | Commit |
|----|----------|---------|-----|--------|
| F1 | Medium | Results page had no heading, jumped straight to goal card | Added "Your savings plan" heading with available savings summary | `d34db7d` |
| F2 | Low | Goal picker cards had no interactive feedback on hover/click | Added hover lift (-translate-y-0.5, shadow-lg, border-primary) + active press | `839d278` |
| F3 | Medium | Card icons touching top edge due to CardContent pt-0 default | Applied `!py-8` to override default padding | `9c7ed07` |
| F7 | Low | Header logo linked to `/` (full planner) instead of `/goal-calculator` | Fixed Link `to` prop | `5384b61` |

### Deferred to V2 (3 issues)

| ID | Severity | Finding | Reason for Deferral |
|----|----------|---------|---------------------|
| F4 | Low | Retirement impact callout uses plain text in dashed card. Could benefit from a subtle icon or color accent. | Functional as-is. Dashed border already differentiates from goal cards. Enhancement, not a blocker. |
| F5 | Low | "Start over" button could be even more visually de-emphasized (e.g., smaller text). | Ghost variant is already the lightest weight. Adequate hierarchy: primary CTA > outline > ghost. |
| F6 | Low | No animated transitions between steps (pick > config > basics > results). | Would require framer-motion or similar. Scope creep for V1. Steps transition instantly which is fast and functional. |

## Design System Compliance

- **Typography:** Consistent with app-wide Inter/system font stack
- **Colors:** Primary blue for CTAs and selected states, green/amber/red for feasibility badges, muted foreground for secondary text
- **Spacing:** Consistent `space-y-` patterns, `max-w-xl`/`max-w-2xl`/`max-w-3xl` for content width
- **Components:** Uses shadcn/ui (Card, Button, Input, Label), Lucide icons throughout
- **No em dashes:** All user-facing copy uses commas, periods, and colons per CLAUDE.md rules
- **Shared inputs:** BasicsForm uses CurrencyInput and NumberInput wrappers

## Mobile Responsiveness

Tested at 375x812 (iPhone SE/13 mini equivalent):
- GoalPicker: 2-column grid, last tile (Custom Goal) sits alone on row 5
- GoalConfig: All form elements stack vertically, segmented controls wrap naturally
- BasicsForm: Full-width inputs, Calculate button spans full width
- Results: Cards, progress bars, and action buttons all render correctly

## Accessibility Notes

- All interactive elements have cursor-pointer
- Form inputs have associated labels
- Heading hierarchy: h1 on picker, h2 on results
- Feasibility badges use both color AND text (not color-only)
- Button text is descriptive ("Plan for another goal", "Edit basics", not just icons)

## Verdict

**PASS** for V1 launch. All blocking and medium-severity design issues resolved. Three low-priority enhancements logged for V2 consideration.
