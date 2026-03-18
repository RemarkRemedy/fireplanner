# ProjectionLab Onboarding Research (2026-02-24)

## Context
Walked through ProjectionLab v4.5 onboarding via Playwright. Full competitor analysis for Fireplanner UX improvements.

## Onboarding Flow (4 phases)

### Phase 1: Account Setup (~2 min, 4 steps)
1. Mode select: Normal walkthrough vs. Sandbox (pre-populated demo)
2. About You: expandable cards (individual/couple, age, location, currency)
3. Category filter: "Which finances do you have?" multi-select grid (Savings/Investments/Real Assets/Debt)
4. Balance entry: just dollar amounts per category, nothing else

### Phase 2: Dashboard Tour (11 tooltip steps)
- Guided popovers explaining Dashboard, Current Finances, Progress pages
- Teaches data flow: Current Finances feeds Plans, edits create Progress Points

### Phase 3: Plan Wizard (6 steps with live preview chart)
1. Milestones: Retirement, Life Expectancy, FI (configurable triggers, not fixed fields)
2. Assumptions: Fixed Rates / Historical / Advanced (3 complexity tiers)
3. Income: typed streams (Salary, RSU, Pension, etc.) with smart defaults
4. Cash Flow Priorities: priority queue for allocating excess income
5. Expenses: typed categories with "Flexibility" tag (Essential vs. Discretionary)
6. Real Assets: property, vehicles, etc.

### Phase 4: Full Plan View
- Single screen: chart + inputs + analytics tabs (Plan, Cash Flow, Tax, Monte Carlo, Compare, Reports, Estate)
- Age scrubber for time-travel through financial life
- Bottom panel with Accounts/Income/Expenses/Real Assets/Priorities

## Key UX Patterns Worth Adopting

### 1. Progressive Disclosure via Expandable Cards
- Every form section is a collapsed card showing icon + title + current value + chevron
- Only expand to edit, reduces cognitive load
- Smart defaults mean most cards can be skipped

### 2. Get to Value Fast
- Only 4 steps before seeing the dashboard with net worth visualized (~2 min)
- Plan wizard shows a live preview chart that updates as you add income/expenses

### 3. Typed Income/Expense Categories
- Modal picker with icon grid (Salary, Hourly, RSU, Pension, Social Security, etc.)
- Each type has pre-configured defaults (time range, growth, tax handling)
- Country-aware: account types change by jurisdiction

### 4. Milestones Over Fixed Fields
- Life events as composable, configurable rules
- FI milestone: "Net Worth >= 25X Spending" (not a fixed dollar amount)
- Trigger types: At date / At year / Net Worth condition

### 5. Complexity Tiers for Assumptions
- Fixed Rates (3 numbers) / Historical / Advanced
- Most users just accept defaults and move on

### 6. Cash Flow Priority Queue
- "Where do you want your money to go?" in priority order
- More intuitive than asking "what's your savings rate?"

### 7. Consistent Visual Language
- Teal: accounts/current state
- Purple: plans/projections
- Orange/amber: expenses
- Each income/expense type has a distinct colored icon

### 8. Plan-vs-Actual Progress Tracking
- Auto-creates "progress points" when user updates Current Finances
- Overlays actual progress on plan projections over time

## Recommended Approach for Fireplanner

**Approach B+C: Focused setup wizard + smarter InputsPage defaults**

- A `/setup` wizard route after StartPage that collects key inputs in 5-6 focused steps with live preview
- InputsPage improvements: first-visit auto-expand behavior, "next recommended" hints
- Effort: ~4-6 days total

**IMPORTANT: Do this AFTER features are complete and bugs are fixed.** Onboarding is a last-mile UX layer that should reflect the final product. Building it while features are still being added creates rework.

## Screenshots Saved
- projectionlab-dashboard.png
- projectionlab-about-you.png
- projectionlab-current-finances-select.png
- projectionlab-savings.png
- projectionlab-add-investments.png
- projectionlab-current-finances.png
- projectionlab-progress.png
- projectionlab-milestones.png
- projectionlab-assumptions.png
- projectionlab-income-types.png
- projectionlab-salary-form.png
- projectionlab-income-added.png
- projectionlab-priorities.png
- projectionlab-expense-form.png
- projectionlab-plan-setup.png
- projectionlab-full-plan.png
- projectionlab-cashflow.png
- projectionlab-monte-carlo.png

## YouTube References
- Rob Berger review (15 min): https://www.youtube.com/watch?v=k0iEIfMxBEc
- ProjectionLab YouTube channel has Getting Started walkthrough by Kyle Nolan
