# ILP Disabled Corridor Inventory

## Purpose
This is the implementation-ready Phase 0 inventory for surfacing published-but-unmodeled corridors in the catalog as greyed-out choices.

This file is intentionally narrower than the rollout plan:
- exact product IDs
- exact disabled row or disabled card inventory
- proposed Phase 0 IDs
- user-facing labels
- render mode

## Scope Rules

### Included in Phase 0
- confirmed published corridors that represent real catalog choices a user could reasonably expect to select

### Excluded from Phase 0
- `PRUActive LinkGuard`
  - reason: this is a behavioral lock-in / withdrawal-modeling gap, not an alternate catalog choice
- uncertain families not yet source-verified
  - `HSBC Wealth Harvest`
  - `Etiqa Invest starter`

## Render Modes

### Disabled corridor rows under an existing product card
Use when the current product card already represents the family correctly and the missing items are additional corridors within that family.

### Disabled product cards
Use when the current catalog already splits the family at the product-card level rather than the corridor-row level.

Current example:
- `HSBC Wealth Focus (Flexi N)` is already split into separate product cards by flexi term

### Large-family render note
For families with many disabled corridors, especially the confirmed Tokio families, Phase 0 should preserve per-corridor IDs in the data model but may default the UI to a collapsed range summary first, for example:
- `SGD / Premium Payment Term 5-24 years`
- `SGD / Premium Payment Term 16-30 years`

The expanded view can still enumerate the individual corridors for promotion tracking and source fidelity.

## ID Conventions
- For families already using `sgd-mip-*` executable IDs, keep that pattern for Phase 0 even if the source PDF speaks in `Premium Payment Term` language.
- Labels should follow source-facing language even when the ID keeps the legacy `mip` pattern.
- Proposed IDs below are Phase 0 IDs. Promotion to executable may later rename a few of them if the kernel wants stricter payment-structure semantics.

## Disabled Corridor Rows

### AIA Singapore

#### `aia-platinum-wealth-elite-2`
- Product: `AIA Platinum Wealth Elite 2.0`
- Source: `WA_Sum_201106386R_PWE2.0_Jul2025.pdf`
- Current executable variant:
  - `sgd-mip-5`
- Source-backed gap:
  - `single pay`
  - regular pay can be extended at onset up to `10 years`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-single-pay` | `SGD / Single Pay` | source explicitly offers single pay |
| `sgd-mip-6` | `SGD / Regular Pay 6 years` | source allows extension beyond 5 at onset |
| `sgd-mip-7` | `SGD / Regular Pay 7 years` | same family |
| `sgd-mip-8` | `SGD / Regular Pay 8 years` | same family |
| `sgd-mip-9` | `SGD / Regular Pay 9 years` | same family |
| `sgd-mip-10` | `SGD / Regular Pay 10 years` | same family |

#### `aia-platinum-wealth-legacy`
- Product: `AIA Platinum Wealth Legacy`
- Source: `WA_Sum_201106386R_PWL_Jul2025.pdf`
- Current executable variant:
  - `sgd-mip-5`
- Source-backed gap:
  - `single pay`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-single-pay` | `SGD / Single Pay` | source offers single pay or regular pay for 5 years |

#### `aia-pro-achiever-3`
- Product: `AIA Pro Achiever 3.0`
- Source: `WA_Sum_201106386R_APA3.0_Oct2024.pdf`
- Current executable variant:
  - `sgd-iip-10`
- Source-backed gap:
  - `IIP 15`
  - `IIP 20`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-iip-15` | `SGD / IIP 15 years` | published IIP option |
| `sgd-iip-20` | `SGD / IIP 20 years` | published IIP option |

### FWD Singapore

#### `fwd-invest-first-summit`
- Product: `FWD Invest First Summit`
- Source: `FWD_Invest First Summit_Summary.pdf`
- Current executable variant:
  - `sgd-mip-10`
- Source-backed gap:
  - premium payment term ranges from `10` to `30` years
- Phase 0 rule:
  - keep `sgd-mip-*` ID continuity
  - use `Premium Payment Term` in labels

Disabled rows:
- `sgd-mip-11` -> `SGD / Premium Payment Term 11 years`
- `sgd-mip-12` -> `SGD / Premium Payment Term 12 years`
- `sgd-mip-13` -> `SGD / Premium Payment Term 13 years`
- `sgd-mip-14` -> `SGD / Premium Payment Term 14 years`
- `sgd-mip-15` -> `SGD / Premium Payment Term 15 years`
- `sgd-mip-16` -> `SGD / Premium Payment Term 16 years`
- `sgd-mip-17` -> `SGD / Premium Payment Term 17 years`
- `sgd-mip-18` -> `SGD / Premium Payment Term 18 years`
- `sgd-mip-19` -> `SGD / Premium Payment Term 19 years`
- `sgd-mip-20` -> `SGD / Premium Payment Term 20 years`
- `sgd-mip-21` -> `SGD / Premium Payment Term 21 years`
- `sgd-mip-22` -> `SGD / Premium Payment Term 22 years`
- `sgd-mip-23` -> `SGD / Premium Payment Term 23 years`
- `sgd-mip-24` -> `SGD / Premium Payment Term 24 years`
- `sgd-mip-25` -> `SGD / Premium Payment Term 25 years`
- `sgd-mip-26` -> `SGD / Premium Payment Term 26 years`
- `sgd-mip-27` -> `SGD / Premium Payment Term 27 years`
- `sgd-mip-28` -> `SGD / Premium Payment Term 28 years`
- `sgd-mip-29` -> `SGD / Premium Payment Term 29 years`
- `sgd-mip-30` -> `SGD / Premium Payment Term 30 years`

#### `fwd-invest-first-max`
- Product: `FWD Invest First Max`
- Source: `WA_Sum_200501737H_ILP05_RP_Feb2024.pdf`
- Current executable variant:
  - `sgd-mip-10`
- Source-backed gap:
  - premium payment term ranges from `10` to `30` years
- Phase 0 rule:
  - keep `sgd-mip-*` ID continuity
  - use `Premium Payment Term` in labels

Disabled rows:
- `sgd-mip-11` -> `SGD / Premium Payment Term 11 years`
- `sgd-mip-12` -> `SGD / Premium Payment Term 12 years`
- `sgd-mip-13` -> `SGD / Premium Payment Term 13 years`
- `sgd-mip-14` -> `SGD / Premium Payment Term 14 years`
- `sgd-mip-15` -> `SGD / Premium Payment Term 15 years`
- `sgd-mip-16` -> `SGD / Premium Payment Term 16 years`
- `sgd-mip-17` -> `SGD / Premium Payment Term 17 years`
- `sgd-mip-18` -> `SGD / Premium Payment Term 18 years`
- `sgd-mip-19` -> `SGD / Premium Payment Term 19 years`
- `sgd-mip-20` -> `SGD / Premium Payment Term 20 years`
- `sgd-mip-21` -> `SGD / Premium Payment Term 21 years`
- `sgd-mip-22` -> `SGD / Premium Payment Term 22 years`
- `sgd-mip-23` -> `SGD / Premium Payment Term 23 years`
- `sgd-mip-24` -> `SGD / Premium Payment Term 24 years`
- `sgd-mip-25` -> `SGD / Premium Payment Term 25 years`
- `sgd-mip-26` -> `SGD / Premium Payment Term 26 years`
- `sgd-mip-27` -> `SGD / Premium Payment Term 27 years`
- `sgd-mip-28` -> `SGD / Premium Payment Term 28 years`
- `sgd-mip-29` -> `SGD / Premium Payment Term 29 years`
- `sgd-mip-30` -> `SGD / Premium Payment Term 30 years`

### Income Insurance

#### `income-legacy-flex-solitaire`
- Product: `Legacy Flex Solitaire (VA3S / VA3R)`
- Source: `VA3R_VA3S_Summary.pdf`
- Current executable variants:
  - `sgd-regular-mip-5`
  - `sgd-regular-mip-10`
- Source-backed gap:
  - `single premium / MIP 5`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-mip-5-single-premium` | `SGD / Single Premium / MIP 5 years` | aligns with existing finite-MIP single-premium pattern elsewhere in catalog |

### Etiqa

#### `etiqa-invest-flex-wealth-ii`
- Product: `Invest flex wealth II`
- Source: `EIP_Invest flex wealth II_Product Summary.pdf`
- Current executable variants:
  - `sgd-mip-10`
  - `sgd-mip-15`
  - `sgd-mip-20`
- Source-backed gap:
  - `3-year`
  - `5-year`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-mip-3` | `SGD / MIP 3 years` | published corridor |
| `sgd-mip-5` | `SGD / MIP 5 years` | published corridor |

#### `etiqa-invest-wealth-purpose`
- Product: `Invest Wealth Purpose`
- Source: `EIP_Invest Wealth Purpose_Product Summary.pdf`
- Current executable variants:
  - `sgd-mip-10`
  - `sgd-mip-15`
  - `sgd-mip-20`
- Source-backed gap:
  - `3-year`
  - `5-year`

| Proposed ID | Label | Notes |
|---|---|---|
| `sgd-mip-3` | `SGD / MIP 3 years` | published corridor |
| `sgd-mip-5` | `SGD / MIP 5 years` | published corridor |

### Singlife

#### `singlife-legacy-invest`
- Product: `Singlife Legacy Invest`
- Source: `SinglifeLegacyInvest_PS_Dec25.pdf`
- Current executable variant:
  - `sgd-mip-10-term-15`
- Source-backed family:
  - `Single Premium` with policy term `10` or `15`
  - `3 Years` with policy term `10`, `15`, `20`
  - `5 Years` with policy term `10`, `15`, `20`
  - `10 Years` with policy term `15`, `20`, `25`

Disabled rows:
- `sgd-single-premium-term-10` -> `SGD / Single Premium / Policy Term 10 years`
- `sgd-single-premium-term-15` -> `SGD / Single Premium / Policy Term 15 years`
- `sgd-mip-3-term-10` -> `SGD / Premium Payment Term 3 years / Policy Term 10 years`
- `sgd-mip-3-term-15` -> `SGD / Premium Payment Term 3 years / Policy Term 15 years`
- `sgd-mip-3-term-20` -> `SGD / Premium Payment Term 3 years / Policy Term 20 years`
- `sgd-mip-5-term-10` -> `SGD / Premium Payment Term 5 years / Policy Term 10 years`
- `sgd-mip-5-term-15` -> `SGD / Premium Payment Term 5 years / Policy Term 15 years`
- `sgd-mip-5-term-20` -> `SGD / Premium Payment Term 5 years / Policy Term 20 years`
- `sgd-mip-10-term-20` -> `SGD / Premium Payment Term 10 years / Policy Term 20 years`
- `sgd-mip-10-term-25` -> `SGD / Premium Payment Term 10 years / Policy Term 25 years`

Label consistency note:
- when Phase 0 ships, make sure the existing executable `sgd-mip-10-term-15` picker label also shows both dimensions clearly, so the new disabled rows do not read more precisely than the already-executable row

### Tokio Marine

#### `tokio-marine-atlas-wealth`
- Product: `TM Atlas Wealth`
- Source: `TML_UNWO_TPDN_CIN_Summary.pdf`
- Current executable variants:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Source-backed family:
  - premium payment term ranges from `5` to `25` years
- Phase 0 expansion rule:
  - for each missing term `5..24`
  - surface two disabled rows:
    - base
    - advanced death

Disabled row templates:
- `sgd-mip-{N}` -> `SGD / Premium Payment Term {N} years`
- `sgd-mip-{N}-advanced-death` -> `SGD / Premium Payment Term {N} years / Advanced Death`

Exact missing terms:
- `{N} ∈ {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}`

#### `tokio-marine-affluence-atfuture`
- Product: `Affluence@Future`
- Source: `TML_UNZA_TPDN_CIN_Summary.pdf`
- Current executable variants:
  - `sgd-mip-15`
  - `sgd-mip-15-advanced-death`
  - `sgd-mip-15-advanced-death-life-benefit-rider`
- Source-backed family:
  - premium payment term ranges from `15` to `30` years
- Phase 0 expansion rule:
  - for each missing term `16..30`
  - surface three disabled rows:
    - base
    - advanced death
    - advanced death with life benefit rider

Disabled row templates:
- `sgd-mip-{N}` -> `SGD / Premium Payment Term {N} years`
- `sgd-mip-{N}-advanced-death` -> `SGD / Premium Payment Term {N} years / Advanced Death`
- `sgd-mip-{N}-advanced-death-life-benefit-rider` -> `SGD / Premium Payment Term {N} years / Advanced Death + Life Benefit Rider`

Exact missing terms:
- `{N} ∈ {16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30}`

#### `tokio-marine-goclassic`
- Product: `#goClassic`
- Source: `TML_UNWU_TPDN_CIN_Summary.pdf`
- Current executable variants:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Source-backed family:
  - premium payment term ranges from `5` to `25` years

Disabled row templates:
- `sgd-mip-{N}` -> `SGD / Premium Payment Term {N} years`
- `sgd-mip-{N}-advanced-death` -> `SGD / Premium Payment Term {N} years / Advanced Death`

Exact missing terms:
- `{N} ∈ {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}`

#### `tokio-marine-goclassic-secure`
- Product: `#goClassic Secure`
- Source: `TML_UNXN_TPDN_CIN_Summary.pdf`
- Current executable variants:
  - `sgd-mip-25`
  - `sgd-mip-25-advanced-death`
- Source-backed family:
  - premium payment term ranges from `5` to `25` years

Disabled row templates:
- `sgd-mip-{N}` -> `SGD / Premium Payment Term {N} years`
- `sgd-mip-{N}-advanced-death` -> `SGD / Premium Payment Term {N} years / Advanced Death`

Exact missing terms:
- `{N} ∈ {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24}`

#### `tokio-marine-goassure`
- Product: `#goAssure`
- Source: `TML_UNYA_TPDY_CIN_Summary.pdf`
- Current executable variant:
  - `sgd-mip-10`
- Source-backed family:
  - published choices `5`, `10`, `15`, `20`, `25`

Disabled rows:
- `sgd-mip-5` -> `SGD / Premium Payment Term 5 years`
- `sgd-mip-15` -> `SGD / Premium Payment Term 15 years`
- `sgd-mip-20` -> `SGD / Premium Payment Term 20 years`
- `sgd-mip-25` -> `SGD / Premium Payment Term 25 years`

#### `tokio-marine-goaffluence`
- Product: `#goAffluence`
- Source: `TML_UNYD_TPDN_CIN_Summary.pdf`
- Current executable variants:
  - `sgd-mip-15`
  - `sgd-mip-15-advanced-death`
  - `sgd-mip-15-advanced-death-life-benefit-rider`
- Source-backed family:
  - premium payment term ranges from `15` to `30` years

Disabled row templates:
- `sgd-mip-{N}` -> `SGD / Premium Payment Term {N} years`
- `sgd-mip-{N}-advanced-death` -> `SGD / Premium Payment Term {N} years / Advanced Death`
- `sgd-mip-{N}-advanced-death-life-benefit-rider` -> `SGD / Premium Payment Term {N} years / Advanced Death + Life Benefit Rider`

Exact missing terms:
- `{N} ∈ {16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30}`

## Disabled Product Cards

### HSBC Life

The current catalog already models `Wealth Focus` as separate product cards by flexi term. The missing corridors should therefore be surfaced as disabled product cards, not extra rows under `Flexi 1`, `Flexi 3`, or `Flexi 5`.

#### Disabled card: `hsbc-life-wealth-focus-flexi-2`
- Product label: `Wealth Focus (Flexi 2)`
- Source family: `WF brochure.pdf`
- Disabled corridor rows inside card:
  - `sgd-mip-10` -> `SGD / MIP 10 years`
  - `usd-mip-10` -> `USD / MIP 10 years`

#### Disabled card: `hsbc-life-wealth-focus-flexi-4`
- Product label: `Wealth Focus (Flexi 4)`
- Source family: `WF brochure.pdf`
- Disabled corridor rows inside card:
  - `sgd-mip-10` -> `SGD / MIP 10 years`
  - `usd-mip-10` -> `USD / MIP 10 years`

## Promotion Checklist
When a disabled corridor becomes executable:
- remove it from `publishedUnmodeledCorridors`
- add the real executable variant
- add or update parser/product-family tests
- rebuild `catalogSnapshot.ts`
- ensure no product carries the same corridor ID in both executable and disabled lists

## Notes For PR 1
- `FWD Invest First Summit` and `FWD Invest First Max` should use source-facing `Premium Payment Term` labels even if Phase 0 IDs keep the legacy `sgd-mip-*` naming.
- `Singlife Legacy Invest` is the only confirmed Phase 0 family here where both premium payment term and policy term need to be shown in the label.
- `HSBC Wealth Focus` is the only confirmed Phase 0 family here that should render as disabled product cards instead of disabled rows.
- The 92-policy corpus pass says these products are already `supported-now`; these disabled entries represent corridor incompleteness inside supported families, not unsupported products.
