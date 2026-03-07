# SGFirePlanner Results Payload v2

This document is the canonical contract for the companion POST payload from Fireplanner to Expense.

- Producer: Fireplanner companion mode (`POST /api/planner/results`)
- Consumer: Expense companion bridge (`/api/planner/results` endpoint)
- Schema file: `docs/sgfireplanner-results-payload-v2.schema.json`

## Canonical Payload (JSONC)
```jsonc
{
  // Contract version for the results payload.
  "schema_version": 2,

  // UTC timestamp when this result was produced.
  "computed_at_utc": "2026-03-05T12:34:56Z",

  // Stable hash over material assumptions and inputs used for this run.
  "input_signature": "sha256:5aa7...",

  // Scenario identity from companion mode.
  "scenario_id": "base",
  "scenario_name": "Base Plan",

  // Simulation provenance.
  "simulation_method": "parametric", // parametric | bootstrap | fat_tail
  "n_simulations": 10000,
  "computation_time_ms": 420,
  "cached": false,

  // Retirement horizon and age targets.
  "horizon_years": 35,
  "target_fire_age": 55,

  // First age where the p50 portfolio reaches required_portfolio.
  "projected_fire_age_p50": 57,

  // Real annual spending target used for decumulation calculations.
  "annual_expenses_target_real": 48000,

  // Portfolio target and basis used to derive it.
  "required_portfolio": 1500000,
  "required_portfolio_basis": "wr_safe_90", // wr_safe_95 | wr_safe_90 | wr_safe_85 | wr_safe_50 | explicit_amount

  // Constant savings rate needed from now to target_fire_age under deterministic approximation.
  "required_savings_rate": 0.28,

  // Probability that the portfolio survives the full horizon.
  "p_success": 0.91,

  // Safe withdrawal rates at different confidence targets.
  // Higher values mean more withdrawal capacity (better), not "user should withdraw this much".
  // wr_safe_95: highest withdrawal rate that still gives about 95% success (more conservative).
  // wr_safe_90: highest withdrawal rate that still gives about 90% success (conservative).
  // wr_safe_50: highest withdrawal rate that still gives about 50% success (very aggressive).
  "wr_safe_95": 0.032,
  "wr_safe_90": 0.036,
  "wr_safe_85": 0.040,
  "wr_safe_50": 0.047,

  // Provenance for wr_safe_50 during migration.
  "wr_safe_50_source": "optimized_confidence_50", // optimized_confidence_50 | strategy_proxy | withdrawal_band_proxy

  // Failure probabilities by early-retirement bins.
  "fail_prob_0_5y": 0.03,
  "fail_prob_6_10y": 0.04,

  // Terminal portfolio percentiles across simulations.
  "terminal_p5": 120000,
  "terminal_p50": 880000,
  "terminal_p95": 2100000,

  // Median portfolio at target_fire_age.
  "portfolio_at_fire_p50": 1700000,

  // Human-readable and machine-readable allocation.
  "allocation_summary": "Stocks 65 / Bonds 25 / Cash 5 / Gold 3 / CPF 2",
  "allocation_weights": {
    "usEquities": 0.35,
    "sgEquities": 0.15,
    "intlEquities": 0.10,
    "bonds": 0.25,
    "reits": 0.05,
    "gold": 0.03,
    "cash": 0.05,
    "cpf": 0.02
  }
}
```

## Normative Definitions

### Failure
A simulation path fails at the first retirement year where the post-withdrawal/post-return portfolio balance is less than or equal to zero.

### fail_prob_0_5y
`count(paths with first failure year in retirement years 1..5) / n_simulations`

### fail_prob_6_10y
`count(paths with first failure year in retirement years 6..10) / n_simulations`

### p_success
`1 - (total_failed_paths / n_simulations)`

### wr_safe_95
Highest withdrawal rate that still gives approximately 95% success over the full retirement horizon (more conservative).

### wr_safe_90
Highest withdrawal rate that still gives approximately 90% success over the full retirement horizon (conservative).

### wr_safe_85
Highest withdrawal rate that still gives approximately 85% success over the full retirement horizon (moderate).

### wr_safe_50
Highest withdrawal rate that still gives approximately 50% success over the full retirement horizon (very aggressive).

## Required Validation Rules

- `0 <= p_success <= 1`
- `0 <= fail_prob_0_5y <= 1`
- `0 <= fail_prob_6_10y <= 1`
- `0 <= wr_safe_95, wr_safe_90, wr_safe_85, wr_safe_50 <= 1`
- If all WR fields are present: `wr_safe_95 <= wr_safe_90 <= wr_safe_85 <= wr_safe_50`
- If all terminal fields are present: `terminal_p5 <= terminal_p50 <= terminal_p95`
- If `allocation_weights` exists: sum of weights must be within `1.0 +/- 0.01`

## Historical Mapping (v1 -> v2 semantics)

| Legacy v1 field | v2 field |
|---|---|
| `schemaVersion` | `schema_version` |
| `p_success` | `p_success` |
| `WR_critical_50` | `wr_safe_50` |
| `wr_critical_10` | `wr_safe_95` |
| `wr_critical_90` | `wr_safe_85` |
| `horizonYears` | `horizon_years` |
| `allocationSummary` | `allocation_summary` |
| `fire_age` | `projected_fire_age_p50` |
| `portfolio_at_fire` | `portfolio_at_fire_p50` |

This mapping is for migration reference only.

## Runtime Compatibility Policy

- Producer payload format is v2 only (`schema_version = 2`).
- Consumer accepts v2 only; non-v2 payloads are rejected.
- Do not emit legacy v1 alias keys in canonical payloads.
