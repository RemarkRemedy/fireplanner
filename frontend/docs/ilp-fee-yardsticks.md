# ILP Fee Everyday Yardsticks

Source of truth for the rotating `Everyday yardsticks` panel used in [IlpFeeStory.tsx](/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/components/ilp/IlpFeeStory.tsx) is [ilpFeeYardsticks.ts](/Users/tj/TJDevelopment/fireplanner-ilp-fee-dashboard-consolidation/frontend/src/components/ilp/ilpFeeYardsticks.ts).

## Math

- Real fee basis:
  `realTotalEstimatedFees = realWrapperFees + realFundCharges + inceptionCharges - realBonuses`
- Annualized real cost:
  `annualizedCost = realTotalEstimatedFees / horizonYears`
- Per-example yearly quantity:
  `quantityPerYear = annualizedCost / unitPrice`

Display cadence rules:

| Condition | Output style |
|---|---|
| `quantityPerYear >= 365` | `about X per day` |
| `quantityPerYear >= 52` | `about X per week` |
| `quantityPerYear >= 12` | `about X per month` |
| `quantityPerYear >= 1.5` | `about X per year` |
| `quantityPerYear >= 0.85` | `roughly one per year` |
| otherwise | `about one every N years` |

Band selection:

- `SGD` policies use the `realTotalEstimatedFees` total to select one of the SGD bands below.
- `USD` policies currently use a single fallback comparison set in code.
- Values below `S$1k` clamp to the first SGD band.
- Values above `S$75k` clamp to the final SGD band.
- Every SGD band intentionally keeps the same eight low-dollar anchors first:
  `kopi`, `Starbucks coffee`, `hawker lunch`, `Big Mac meal`, `bubble tea`, `MRT ride`, `Grab ride`, and `movie ticket`.

## Worked Example

Current story route example:

- Product: `AIA Elite Secure Income - 5 Pay`
- Variant: `sgd-mip-5`
- Horizon: `15 years`
- Real wrapper fees: `S$2,418.804138071125`
- Real fund charges: `S$3,695.2667041804934`
- Inception charges: `S$0`
- Real bonuses: `S$772.6235782464746`

Real-fee basis:

```text
realTotalEstimatedFees
= realWrapperFees + realFundCharges + inceptionCharges - realBonuses
= 2418.804138071125 + 3695.2667041804934 + 0 - 772.6235782464746
= 5341.447264005144
```

Annualized:

```text
annualizedCost = 5341.447264005144 / 15
               = 356.09648426700954
```

That lands in the `S$5k–10k` band.

## Bands

### S$1k–5k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | casual dinner for two | 70 |
| 10 | full grocery run | 120 |
| 11 | aircon servicing visit | 90 |
| 12 | concert ticket | 160 |
| 13 | pair of running shoes | 180 |
| 14 | office chair | 450 |
| 15 | espresso machine | 900 |
| 16 | weekend staycation | 350 |
| 17 | return Bangkok flight | 250 |
| 18 | short Bali trip | 600 |
| 19 | new iPhone | 1,500 |
| 20 | MacBook Air | 1,800 |

### S$5k–10k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | weekend staycation | 350 |
| 10 | return Bangkok flight | 250 |
| 11 | short Bali trip | 600 |
| 12 | return Tokyo flight | 900 |
| 13 | family cruise | 3,000 |
| 14 | premium smartwatch | 600 |
| 15 | new iPhone | 1,500 |
| 16 | gaming laptop | 2,500 |
| 17 | dining table set | 1,800 |
| 18 | fridge | 1,800 |
| 19 | washer-dryer set | 2,200 |
| 20 | phone-and-laptop refresh | 3,500 |

### S$10k–15k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | return Tokyo flight | 900 |
| 10 | family cruise | 3,000 |
| 11 | gaming laptop | 2,500 |
| 12 | phone-and-laptop refresh | 3,500 |
| 13 | preschool term | 3,000 |
| 14 | one-room renovation package | 6,000 |
| 15 | annual family holiday | 5,000 |
| 16 | hospital cash buffer | 5,000 |
| 17 | regional weekend trip for two | 1,800 |
| 18 | premium road bike | 4,000 |
| 19 | home-office setup for two | 5,000 |
| 20 | living-room refresh | 4,000 |

### S$15k–20k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | major appliance refresh | 7,000 |
| 10 | short Europe trip for two | 8,000 |
| 11 | car down-payment slice | 10,000 |
| 12 | kitchen refresh package | 9,000 |
| 13 | Japan airfare for a family of four | 4,000 |
| 14 | household gadget refresh | 6,000 |
| 15 | pair of premium laptops | 5,000 |
| 16 | Japan getaway for two | 1,500 |
| 17 | premium road bike | 4,000 |
| 18 | pair of ergonomic office chairs | 1,800 |
| 19 | one-room renovation package | 6,000 |
| 20 | annual family holiday | 5,000 |

### S$20k–30k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | major home-renovation phase | 15,000 |
| 10 | full furnishing package | 12,000 |
| 11 | short Europe trip for a family | 12,000 |
| 12 | full appliance refresh | 8,000 |
| 13 | medical emergency buffer | 20,000 |
| 14 | career-break buffer | 15,000 |
| 15 | year of family grocery top-ups | 12,000 |
| 16 | small used car purchase | 28,000 |
| 17 | resale-flat furnishing refresh | 18,000 |
| 18 | home down-payment top-up | 25,000 |
| 19 | overseas relocation buffer | 20,000 |
| 20 | emergency-fund chunk | 25,000 |

### S$30k–50k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | resale-flat furnishing refresh | 18,000 |
| 10 | parental-support buffer | 15,000 |
| 11 | home down-payment top-up | 25,000 |
| 12 | overseas relocation buffer | 20,000 |
| 13 | family travel budget | 15,000 |
| 14 | emergency-fund chunk | 25,000 |
| 15 | year of groceries for a family | 18,000 |
| 16 | full kitchen-and-wardrobe renovation | 35,000 |
| 17 | new family-car down payment | 40,000 |
| 18 | medical-and-dental buffer | 20,000 |
| 19 | year of rent contribution | 30,000 |
| 20 | used-car down payment | 35,000 |

### S$50k–75k

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | extensive home renovation | 50,000 |
| 10 | family emergency fund | 60,000 |
| 11 | major home repair fund | 50,000 |
| 12 | medical-and-caregiving buffer | 30,000 |
| 13 | career-break buffer | 50,000 |
| 14 | used-car down payment | 40,000 |
| 15 | overseas move reserve | 30,000 |
| 16 | used-car cash purchase | 70,000 |
| 17 | four-year tuition reserve | 50,000 |
| 18 | renovation-and-furnishing package | 60,000 |
| 19 | portfolio top-up | 50,000 |
| 20 | family living-cost buffer | 60,000 |

### S$75k+

| # | Example | Unit Price (SGD) |
|---|---|---:|
| 1 | kopi | 1.5 |
| 2 | Starbucks coffee | 7.5 |
| 3 | hawker lunch | 6 |
| 4 | Big Mac meal | 9.5 |
| 5 | bubble tea | 5.5 |
| 6 | MRT ride | 1.8 |
| 7 | Grab ride | 18 |
| 8 | movie ticket | 14 |
| 9 | used-car cash purchase | 70,000 |
| 10 | four-year tuition reserve | 50,000 |
| 11 | renovation-and-furnishing package | 60,000 |
| 12 | portfolio top-up | 50,000 |
| 13 | sabbatical fund | 90,000 |
| 14 | multi-year education reserve | 80,000 |
| 15 | condo down-payment slice | 100,000 |
| 16 | year of household living costs | 80,000 |
| 17 | major medical reserve | 75,000 |
| 18 | financial freedom-fund slice | 100,000 |
| 19 | family flexibility fund | 85,000 |
| 20 | long caregiver runway | 90,000 |
