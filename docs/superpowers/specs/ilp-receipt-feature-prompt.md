# ILP Receipt Image Generator

**Status:** Implemented

## Context

This is for the "Check Before You Sign" marketing campaign. The ILP fee dashboard already computes and displays fee breakdowns for 92+ ILP products. We need to add a "Generate Receipt" button that creates a shareable image summarizing the fee impact in a receipt-style format designed to go viral on social media.

**Campaign spec:** `docs/superpowers/specs/2026-03-27-ilp-launch-campaign-design.md` in the fireplanner repo

## What to build

A "Generate Receipt" button on the fee breakdown page that produces a downloadable PNG image styled like a receipt. The receipt is the viral mechanic of the campaign -- it needs to look good when shared on Instagram Stories, TikTok, WhatsApp, and Telegram.

## Receipt content (all values computed from existing fee breakdown data)

```
+-------------------------------------+
|         YOUR ILP RECEIPT            |
|         -----------------           |
| Product: [Insurer] [Plan Name]      |
|                                     |
| You pay:              $XX,XXX       |
|                                     |
| What you keep:        $XX,XXX       |
| What they keep:       $XX,XXX       |
|                       -------       |
| Fee drag:               XX%         |
|                                     |
| Same $ in index fund: $XX,XXX      |
| (global equity, 7% gross return)    |
| You're leaving on     -------       |
| the table:            $XX,XXX       |
|                                     |
| ----------------------------------- |
| Fees as of [Month Year]             |
| Based on published fund charges.    |
| Actual returns vary.                |
| Generated at sgfireplanner.com/ilp  |
| Check before you sign.              |
+-------------------------------------+
```

## Data mapping

Map receipt fields from the existing fee breakdown computation:

- **Product name**: insurer + plan name (already displayed)
- **You pay**: total premiums paid over the policy term (premium * 12 * years)
- **What you keep**: total premiums minus total fees (net of bonuses). Use the Net Fee value from the fee table -- remember Net = Gross - Bonus invariant
- **What they keep**: total fees net of bonuses
- **Fee drag %**: (what they keep / you pay) * 100
- **Same $ in index fund**: compound the same monthly premium at 7% gross return minus a 0.2% TER (typical global equity ETF) over the same period
- **Leaving on the table**: index fund result minus what you keep

## Design requirements

- **Dimensions**: 1080x1920px (Instagram Story / TikTok native). Also provide a 1080x1080px square variant for feed posts.
- **Style**: Monospace font, receipt-paper aesthetic (slightly off-white background, maybe a subtle paper texture). Should feel like a real receipt, not a polished infographic.
- **Branding**: sgfireplanner.com/ilp URL at the bottom. Small logo if one exists.
- **The "What they keep" line should be visually emphasized** -- larger font, red/bold, or otherwise highlighted. This is the gut-punch.
- **Dark mode compatible**: the receipt itself has its own background (receipt paper), so it works on any IG story background.

## Technical approach

- Use `html-to-image` or `html2canvas` to render a hidden HTML element as a PNG
- The receipt HTML is a styled component rendered off-screen, not a canvas drawn from scratch
- "Generate Receipt" button triggers the render and immediately downloads the PNG (also offer "Copy to clipboard" if the browser supports it via Clipboard API)
- Mobile-first: the button and download flow must work on mobile Safari and Chrome (most users will be on phones)
- Consider Web Share API (`navigator.share`) on mobile for direct sharing to IG Stories, WhatsApp, etc.

## Important constraints

- Do NOT hardcode fee values. All numbers come from the existing fee breakdown computation.
- The receipt must respect the OCF checkbox state: if the user has "Include fund fees (OCF)" toggled on, the receipt should include fund fees in the totals. If off, wrapper fees only. Label accordingly.
- Include the "Fees as of [Month Year]" data freshness stamp using DATA_VINTAGE or equivalent.
- The index fund comparison uses 7% gross return and 0.2% TER as fixed assumptions. These should be constants, not hardcoded inline.
- All values in SGD.
- No personal data in the receipt. It shows the product's fee structure, not the user's financial situation.

## UX flow

1. User selects an ILP product and sees the fee breakdown (existing flow)
2. Below the fee table, a "Generate Your ILP Receipt" button appears
3. Click opens a preview modal showing the receipt
4. Two actions: "Download" (saves PNG) and "Share" (Web Share API on mobile, fallback to download on desktop)
5. Optional: "Copy to clipboard" button

## Files to explore first

- The fee breakdown computation engine (look for `ilpFeeBreakdown.ts` or similar)
- The fee breakdown display component (look for `FeeBreakdownSection.tsx` or similar)
- Existing component patterns and design system in the dashboard
- Package.json to check what image generation libraries are already available

## Out of scope

- No quiz or BS Detector (that's V2)
- No Gleam.io integration (Gleam is a separate platform, not embedded)
- No analytics or tracking (privacy-first)
