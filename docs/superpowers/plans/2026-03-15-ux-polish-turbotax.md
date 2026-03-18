# UX Polish Plan — TurboTax-Inspired Improvements

> Source: Claude Opus UX panel review (2026-03-15)
> Screenshots: ux2-01 through ux2-11 in repo root

## MUST CHANGE (3)

### 1. Hide sidebar on StartPage for new users
The full app navigation (15+ items) is visible before the user enters anything. This signals "this is complex" and causes abandonment. The wizard screens correctly hide the sidebar, but the entry point exposes everything.
- **Fix:** When `setupCompleted === false`, render StartPage inside `SetupLayout` (no sidebar) instead of `PlannerRouteShell`
- **Or:** Collapse/hide the sidebar programmatically for first-time users

### 2. Add expense estimation guidance (Screen 3)
The expenses question is the highest-friction point. Users don't know their monthly expenses and will guess or abandon.
- **Fix:** Add a "Not sure?" expandable helper with Singapore expense benchmarks by life stage:
  - Single renting: $2,000-3,500
  - Couple with HDB: $3,000-5,000
  - Family with kids: $5,000-8,000
- **Or:** Quick calculator (rent + food + transport + utilities)
- **At minimum:** Add "Don't worry about being exact. A rough estimate works fine."

### 3. Default healthcare to ON
OFF creates unrealistically optimistic projections. Healthcare is the largest variable cost in retirement.
- **Fix:** Default `healthcareEnabled` to `true` in INITIAL_VALUES with basic ISP tier pre-selected
- **Copy change:** "We've included basic healthcare costs. You can adjust or disable this."

## SHOULD IMPROVE (8)

### 4. Add "You can always change this later" reassurance
On screens 2-8, add a small muted text near the Continue button or below fields.

### 5. Add "why we need this" line under each question
Each screen heading should have a one-line explanation:
- Age: "We'll use this to estimate your savings timeline."
- Income: "This helps us project your CPF contributions and savings rate."
- Expenses: "Your spending determines how much you need to retire."
- Savings: "This is your starting point for the projection."
- Residency: "Determines CPF rates and tax treatment."
- CPF: "CPF is a major part of your retirement income."
- Property: "Property equity can be part of your retirement net worth."
- Healthcare: "Healthcare costs grow with age."

### 6. Show age + retirement age on review page
The most fundamental inputs are missing from the review summary.

### 7. Replace residency dropdown with radio cards
3 options (Citizen/PR/Foreigner) are better as large tappable cards than a hidden dropdown.

### 8. Change headings to question format
- "Your CPF" → "How much CPF do you have?" or "Let's estimate your CPF"
- "Healthcare planning" → "Should we include healthcare costs?"

### 9. Expand "AWS" jargon
"I receive bonus / AWS" → "I receive a yearly bonus (13th month / AWS)"

### 10. Add transition from wizard to projection
Brief interstitial: "Your plan is ready! Here's your projection." with orientation note about the sidebar and refine cards.

### 11. Show savings rate on review page
"You're saving ~$2,300/month (48% of take-home). That puts you ahead of most Singaporeans."

## DELIGHT OPPORTUNITIES (5)

### 12. Animate FIRE age reveal
Count-up animation from 0 to the FIRE age on the projection page. This is the TurboTax refund moment.

### 13. Animate CPF estimate
When the estimate card appears on screen 6, animate the number counting up from 0.

### 14. Add time estimate on start page
"Set up in under 3 minutes" next to pathway cards.

### 15. Personalized quip after age entry
"25 years to go. Let's make them count." (computed from retirementAge - currentAge)

### 16. Celebrate on review page
"All set! 8 out of 8 steps complete." or "Nice work. Let's see your numbers."

---

## Execution notes

- Items 1-3 are structural changes (routing, defaults, UI components)
- Items 4-11 are copy/text changes (can batch in one commit)
- Items 12-16 are animations/interactions (separate from copy)
- **Retry Gemini 3.1 Pro review** in fresh session with patched MCP (base64 image support)
