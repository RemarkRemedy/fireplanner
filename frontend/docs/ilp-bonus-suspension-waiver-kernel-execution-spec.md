# ILP Bonus-Suspension Waiver Kernel Execution Spec

Last updated: 2026-03-16

## Goal

Add one bounded event-state kernel for products whose published withdrawal or premium-holiday corridors say:

- the event may waive its ordinary event charge, and/or
- the event does not suspend bonus eligibility even though the generic trigger normally would

This is not a full bonus-eligibility engine.

It is a narrow per-event override so the runtime can distinguish an ordinary partial withdrawal from a published exception such as a life-event free withdrawal.

## Why This Is Next

Parser screening hit the same honest-support blocker three times in a row:

1. `Invest Flex (VS1)`
2. `Invest Flex Vantage (VS2)`
3. `Invest Flex TriVantage (VS3)`

All three publish the same mechanic family:

- a partial withdrawal during MIP normally incurs the published withdrawal charge
- a qualifying Life Events Withdrawal Benefit can waive that charge
- the same qualifying withdrawal does not break loyalty-bonus eligibility

The current runtime already supports:

- event-triggered partial-withdrawal charges
- explicit event-level `chargeWaived`
- loyalty-bonus suspension after a partial withdrawal

The remaining gap is therefore narrower than a new withdrawal kernel:

- an event can already waive its charge
- it cannot yet say “do not treat this event as a bonus-suspension trigger”

## Mandatory Proof

Direct calculator proof is sufficient for this kernel slice.

Required proof behaviors:

1. an ordinary partial withdrawal still suspends bonus eligibility
2. a partial withdrawal marked as bonus-suspension-waived does not suspend bonus eligibility
3. charge waiver and bonus-suspension waiver are independent flags

## Structural Contract

Add one optional policy-event field:

- `bonusSuspensionWaived?: boolean`

Initial support scope:

- `partial-withdrawal`
- `premium-holiday`
- `regular-premium-reduction`

The runtime should ignore an event for bonus-suspension calculations when this flag is true, while leaving all other event mechanics unchanged.

## Runtime Definition

For bonus suspension:

1. collect events for the configured suspension trigger
2. exclude any matching event whose `bonusSuspensionWaived` flag is true
3. apply the existing suspension-month overlap math to the remaining events

For event charges:

- do not change the current `chargeWaived` behavior
- do not infer one flag from the other

## Keep vs Add

### Keep

- existing `chargeWaived` event behavior
- existing bonus suspension rules
- existing event charge math

### Add

- event-level bonus-suspension waiver field
- validation for allowed event types
- UI controls so users can author the override explicitly
- direct calculator tests proving the non-regression boundary

## Acceptance Criteria

This slice is complete only if all are true:

1. policy events may carry `bonusSuspensionWaived`
2. validation rejects the flag on unsupported event types
3. the calculator ignores flagged events when computing bonus suspension
4. `chargeWaived` continues to behave independently
5. the kernel gate is green

## Direct Calculator Proof Requirements

Minimum required tests:

1. ordinary partial withdrawal suspends bonus credit
2. bonus-suspension-waived partial withdrawal keeps bonus credit active
3. charge-waived partial withdrawal still suspends bonus credit unless the new flag is also set

## Non-goals

Do not add in this slice:

- automatic qualification logic for life events
- document-proof collection
- event-count caps for life-event withdrawals
- parser promotions by themselves
- a full bonus-state machine beyond the explicit event override
