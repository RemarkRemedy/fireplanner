# AIA Invest Easy Death-Benefit Screen

This note records the next smaller lane after the SmartRetire and HSBC staged-claim branches were screened as too stateful for cheap support expansion.

Products screened:

- `aia-invest-easy-cash-srs`
- `aia-invest-easy-cpf`

## Conclusion

The plain AIA Invest Easy death-benefit corridor is now landed support.

Both summaries publish the same current death-benefit wording:

- `100% of the policy value, less any applicable fees and charges`

On the current supported shell, that is honest to model as the current policy value:

- there is no separate assurance corridor
- there is no protected-floor state
- there is no explicit claim-history dependency
- the current shell already carries the policy value needed for the estimate

## What landed

The current supported boundary now includes:

- the existing single-premium / top-up / recurring-top-up charge corridors
- `Death Benefit Today` as current policy value on the open-ended Invest Easy shell

That support now applies to both Cash/SRS and CPF.

## What still remains outside support

The next protection item in the same summaries is not another plain current-state value metric.

Both products also publish:

- `First Year Accidental Death Benefit`
- payable only if death occurs within 90 days of the accident
- where the accident occurs within one year from the issue date
- amount is the higher of:
  - death benefit, or
  - `110% of single premium paid plus total top-up premium, less total withdrawals`

That is not just a richer death-benefit formula. It is an accident-claim snapshot with event timing and claim-mode gating.

## Recommendation

1. Treat the AIA Invest Easy base death-benefit lane as landed.
2. Keep the first-year accidental-death rider metadata-only unless the team wants a dedicated accident-claim snapshot surface.
3. Reuse this screen as the pattern for other simple `policy value today` death-benefit corridors before reopening heavier claim-state branches.
