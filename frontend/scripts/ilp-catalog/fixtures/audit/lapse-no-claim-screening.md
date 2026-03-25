# ILP Lapse / No-Claim Screening

This note records the first screen of the narrower lapse-state / no-claim corridor after the broader claim-state discovery split.

## Source-backed observation

HSBC Life Flexi Protector and HSBC Wealth Focus both publish an explicit no-benefit rule during lapse.

Examples:
- Wealth Focus: "No Benefits will be payable if a claim arises during the Lapsation Period."
- HSBC Life Flexi Protector: "Should a claim arise during the Lapsation Period, no benefits will be payable."
- Manulife InvestReady (III): the policy "will automatically lapse when the account value is insufficient to cover the monthly deduction due on any policy monthiversary."
- Manulife SmartRetire (V): the policy "will automatically lapse when the account value is insufficient to cover the monthly deduction on any policy monthiversary."
- Tokio Harvest Pro representative corridor: during first-three-year non-payment, the policy is "terminated automatically at the expiry of the grace period and no amount will be payable to You."

The same HSBC Flexi Protector summary also separates:
- grace-period in-force state
- premium-holiday in-force state while account value can still cover charges
- lapse / lapsation state once charges can no longer be covered
- reinstatement after lapse

This is narrower than full reinstatement modeling.

## Existing kernel surface

The calculator already carries:
- explicit `lapse` policy events
- yearly `policyState` of `in-force` or `lapsed`
- payout-state suppression through `kernel:lapse-reinstatement-payout-state`
- automatic lapse on projected account depletion for selected payout-state products

What it did not carry before this slice:
- suppression of `currentDeathBenefitEstimate` when the current snapshot is already inside an explicit lapse period

## Landed current-state fix

This slice now suppresses `currentDeathBenefitEstimate` whenever `monthsAlreadyPaid` falls inside an explicit `lapse` event.

Why this is honest:
- a current death-benefit estimate is a present-tense in-force summary surface
- explicit lapse state already exists in the input model
- published HSBC lapse wording says no benefits are payable while the policy is in the lapsation period

Current verification:
- `src/lib/calculations/ilp.test.ts` includes a Wealth Focus regression proving that `Death Benefit Today` is omitted during an active current lapse event
- `src/lib/calculations/ilp.test.ts` also includes a protected-base InvestReady-family regression proving the same suppression for the assurance-profile current-death-benefit-estimate branch

## Remaining questions on this lane

1. Should other current-state benefit summary surfaces also suppress while lapsed?
2. Is there an honest reusable product-level metadata tag for "no benefits payable during lapse" that should drive current-state suppression explicitly rather than relying on any active lapse event generically?
3. Does premium-holiday no-claim gating unlock any additional executable support beyond current-state suppression, or does the next real step immediately collapse into reinstatement and claim-state handling?

Current answer to question 1:
- no additional today-state benefit card exists today
- the summary UI currently exposes only one current benefit metric: `currentDeathBenefitEstimate`
- the other summary cards are premium / fee / surrender metrics, so there is no second current-state benefit surface to suppress in this lane without adding new product-facing metrics first

## Next best step

This narrower lapse / no-claim lane is mostly exhausted.

There is no second current-state benefit summary surface to screen today, so the next honest step is the heavier SmartRetire post-MIP / target-age corridor lane rather than more lapse-state churn or a premature reinstatement design.
