# HSBC Distribution-Mode Promotion Audit

Date: 2026-03-13

## Decision

V1 accepts a narrow simplifying assumption for selected HSBC products:

- dividend-paying funds are assumed to reinvest by default
- cash dividend payout election remains metadata-only
- the assumption must be shown explicitly in catalog/template warnings

## Product outcomes

### Promote to `supported`

- `hsbc-life-wealth-harvest`
- `hsbc-life-wealth-abundance`

Reason:
- parsers already exist
- modeled fee-drag and exit mechanics are already covered by the completed kernels
- remaining metadata-only items are outside the V1 fee-drag boundary:
  - dividend payout election
  - regular-withdrawal facility
  - administrative restart / life-replacement options

### Keep `partial`

- `hsbc-life-wealth-voyage`

Reason:
- distribution mode is not the only blocker
- Voyage still leaves economically material premium-holiday and loyalty mechanics outside the runtime:
  - premium-holiday charge after free duration
  - premium-holiday backpay AMF reconciliation
  - regular-withdrawal-linked loyalty suspension

## Required release work

To support the promotions safely:

1. flip Harvest and Abundance to `supportStatus: "supported"` / `economicsStatus: "supported"`
2. make the reinvestment-default assumption explicit in parser warnings
3. expand golden coverage to include supported-grade `ocf-stress` fixtures
4. rebuild catalog + family-classification artifacts

## Not part of this decision

- no new dividend-yield assumption model
- no cash-payout simulation
- no change to Voyage support status
