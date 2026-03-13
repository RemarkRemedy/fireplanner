# ILP Promotion Audit

Date: 2026-03-13

## Scope

This audit reviews the current catalog after completion of these workstreams:

- core cashflow kernel
- multi-account structure kernel
- assurance-charge kernel
- bonus-richness kernel

It focuses on whether existing `partial` catalog products can now be promoted to `supported`.

## Promotion Criteria

A product is promotable when:

1. its required kernel workstreams are complete
2. its remaining `metadataOnlyBehaviors` are informational only for the V1 fee-drag scope
3. every public variant has golden coverage
4. the golden gate covers all declared modeled-economics branch tags

## Results

### Promoted

#### PRUVantage Prosper

Decision:
- promote to `supported`

Why:
- required workstreams are complete:
  - core cashflow
  - multi-account structure
  - assurance charge
- remaining metadata-only items are outside V1 fee-drag economics:
  - Growth-account distribution election
  - Premium Pass / Wealth Share / secondary-life options
- supported-grade golden coverage now exists across all public variants plus event-heavy and OCF-stress scenarios

#### PRUVantage Assure II

Decision:
- promote to `supported`

Why:
- required workstreams are complete:
  - core cashflow
  - multi-account structure
  - assurance charge
- manual reduction/resumption of sum assured / Wealth Assure Value is modeled through explicit user-entered resulting-state events
- remaining metadata-only items are outside V1 fee-drag economics:
  - Premium Pass / Wealth Share / change-of-life-assured options
- supported-grade golden coverage now exists across all public variants plus event-heavy, holiday-fallback, assurance-tail, assurance-state-override, and OCF-stress scenarios

### Not Promoted

#### Tokio Marine Wealth Pro (II)

Decision:
- remain `partial`

Why:
- protection-heavy structure is still a real blocker
- remaining unmodeled mechanics are not merely informational
- current modeled subset is useful, but not broad enough for a `supported` claim

#### Tokio Marine Wealth Max (II)

Decision:
- remain `partial`

Why:
- same V1 protection-structure boundary as Wealth Pro (II)

#### HSBC Wealth Abundance / Harvest / Voyage

Decision:
- remain `partial`

Why:
- distribution-mode assumptions are still unresolved for supported-grade promotion
- current subset remains useful, but the support claim should not move yet

## Net Effect

Catalog support boundary changes from:

- `2` supported
- `61` supported-after-kernel
- `29` partial-v1

To:

- `4` supported
- `59` supported-after-kernel
- `29` partial-v1

## Follow-up

Next scaling work should favor parser throughput inside the now-supported families before opening another major kernel workstream.
