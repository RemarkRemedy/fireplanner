# Autopilot Spec: Monte Carlo Stress Scenarios (Phase 4)

## Objective
Add built-in stress-testing scenarios and scenario comparison insights to Monte Carlo planning while preserving companion mode behavior and export compatibility.

## Trigger & Context
Primary planner routes:
- `/stress-test`
- `/planner?token=<TOKEN>&companion=1`

Companion remains additive, local-first, and must keep save-to-phone flow intact.

## Functional Requirements

### 1) Built-in stress scenarios
Add simulation scenario definitions in:
- `frontend/src/lib/simulation/stressScenarios.ts`

Scenario set:
- `Base case`
- `Market crash`: first 3 years returns = `-30%`, `-10%`, `+5%`
- `Inflation spike`: inflation = `6%` for first 5 years
- `Longevity`: extend life expectancy by `+10 years`

Scenarios must transform Monte Carlo engine parameters before run.

### 2) Scenario selector UI
Add selector UI above Run button in Monte Carlo controls:
- multi-select options:
  - Base case
  - Market crash
  - Inflation spike
  - Longevity

Selection drives additional scenario runs for comparison.

### 3) Scenario comparison output
After run, show a comparison table:
- `Scenario`
- `Success Rate`
- `Median Terminal Wealth`
- `Failure Age`

Use existing Monte Carlo outputs where possible:
- `success_rate`
- `terminal_stats.median`
- `failure_distribution` + retirement age mapping

### 4) Visualization requirements
Ensure charts are present and responsive:
- Trajectory bands (from `percentile_bands`)
- Failure distribution histogram (from `failure_distribution`)
- Withdrawal distribution curve (from `withdrawal_bands`)

### 5) Companion compatibility
In companion mode:
- keep marketing/email hidden
- compact planner layout retained
- keep save-to-phone action visible
- post results with same payload format as existing bridge

### 6) Testing
Add/extend E2E coverage for:
- scenario selector affects simulation comparison rows
- export payload still includes required fields
- companion mode still posts results

## Non-Functional Constraints
- No backend changes.
- Maintain normal web behavior outside selected stress scenarios.
- Keep compute local (existing TS Monte Carlo engine/worker path).
