export type YardstickCurrency = 'SGD' | 'USD'

export interface IlpFeeYardstickExample {
  id: string
  singularLabel: string
  pluralLabel: string
  unitPrice: number
}

export interface IlpFeeYardstickBand {
  label: string
  minTotalFees: number
  maxTotalFees: number | null
  examples: IlpFeeYardstickExample[]
}

export interface IlpFeeYardstickMatch extends IlpFeeYardstickExample {
  quantityPerYear: number
  sentence: string
}

const RELATABLE_LOW_DOLLAR_EXAMPLES: IlpFeeYardstickExample[] = [
  { id: 'kopi', singularLabel: 'kopi', pluralLabel: 'kopi', unitPrice: 1.5 },
  { id: 'starbucks-coffee', singularLabel: 'Starbucks coffee', pluralLabel: 'Starbucks coffees', unitPrice: 7.5 },
  { id: 'hawker-lunch', singularLabel: 'hawker lunch', pluralLabel: 'hawker lunches', unitPrice: 6 },
  { id: 'big-mac-meal', singularLabel: 'Big Mac meal', pluralLabel: 'Big Mac meals', unitPrice: 9.5 },
  { id: 'bubble-tea', singularLabel: 'bubble tea', pluralLabel: 'bubble teas', unitPrice: 5.5 },
  { id: 'mrt-ride', singularLabel: 'MRT ride', pluralLabel: 'MRT rides', unitPrice: 1.8 },
  { id: 'grab-ride', singularLabel: 'Grab ride', pluralLabel: 'Grab rides', unitPrice: 18 },
  { id: 'movie-ticket', singularLabel: 'movie ticket', pluralLabel: 'movie tickets', unitPrice: 14 },
]

const SGD_YARDSTICK_BANDS: IlpFeeYardstickBand[] = [
  {
    label: 'S$1k–5k',
    minTotalFees: 1_000,
    maxTotalFees: 5_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'casual-dinner-two', singularLabel: 'casual dinner for two', pluralLabel: 'casual dinners for two', unitPrice: 70 },
      { id: 'full-grocery-run', singularLabel: 'full grocery run', pluralLabel: 'full grocery runs', unitPrice: 120 },
      { id: 'aircon-service', singularLabel: 'aircon servicing visit', pluralLabel: 'aircon servicing visits', unitPrice: 90 },
      { id: 'concert-ticket', singularLabel: 'concert ticket', pluralLabel: 'concert tickets', unitPrice: 160 },
      { id: 'running-shoes', singularLabel: 'pair of running shoes', pluralLabel: 'pairs of running shoes', unitPrice: 180 },
      { id: 'office-chair', singularLabel: 'office chair', pluralLabel: 'office chairs', unitPrice: 450 },
      { id: 'espresso-machine', singularLabel: 'espresso machine', pluralLabel: 'espresso machines', unitPrice: 900 },
      { id: 'staycation', singularLabel: 'weekend staycation', pluralLabel: 'weekend staycations', unitPrice: 350 },
      { id: 'bangkok-flight', singularLabel: 'return Bangkok flight', pluralLabel: 'return Bangkok flights', unitPrice: 250 },
      { id: 'bali-trip', singularLabel: 'short Bali trip', pluralLabel: 'short Bali trips', unitPrice: 600 },
      { id: 'iphone', singularLabel: 'new iPhone', pluralLabel: 'new iPhones', unitPrice: 1_500 },
      { id: 'macbook-air', singularLabel: 'MacBook Air', pluralLabel: 'MacBook Airs', unitPrice: 1_800 },
    ],
  },
  {
    label: 'S$5k–10k',
    minTotalFees: 5_000,
    maxTotalFees: 10_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'staycation', singularLabel: 'weekend staycation', pluralLabel: 'weekend staycations', unitPrice: 350 },
      { id: 'bangkok-flight', singularLabel: 'return Bangkok flight', pluralLabel: 'return Bangkok flights', unitPrice: 250 },
      { id: 'bali-trip', singularLabel: 'short Bali trip', pluralLabel: 'short Bali trips', unitPrice: 600 },
      { id: 'tokyo-flight', singularLabel: 'return Tokyo flight', pluralLabel: 'return Tokyo flights', unitPrice: 900 },
      { id: 'family-cruise', singularLabel: 'family cruise', pluralLabel: 'family cruises', unitPrice: 3_000 },
      { id: 'smartwatch', singularLabel: 'premium smartwatch', pluralLabel: 'premium smartwatches', unitPrice: 600 },
      { id: 'iphone', singularLabel: 'new iPhone', pluralLabel: 'new iPhones', unitPrice: 1_500 },
      { id: 'gaming-laptop', singularLabel: 'gaming laptop', pluralLabel: 'gaming laptops', unitPrice: 2_500 },
      { id: 'dining-set', singularLabel: 'dining table set', pluralLabel: 'dining table sets', unitPrice: 1_800 },
      { id: 'fridge', singularLabel: 'fridge', pluralLabel: 'fridges', unitPrice: 1_800 },
      { id: 'washer-dryer', singularLabel: 'washer-dryer set', pluralLabel: 'washer-dryer sets', unitPrice: 2_200 },
      { id: 'phone-laptop-refresh', singularLabel: 'phone-and-laptop refresh', pluralLabel: 'phone-and-laptop refreshes', unitPrice: 3_500 },
    ],
  },
  {
    label: 'S$10k–15k',
    minTotalFees: 10_000,
    maxTotalFees: 15_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'tokyo-flight', singularLabel: 'return Tokyo flight', pluralLabel: 'return Tokyo flights', unitPrice: 900 },
      { id: 'family-cruise', singularLabel: 'family cruise', pluralLabel: 'family cruises', unitPrice: 3_000 },
      { id: 'gaming-laptop', singularLabel: 'gaming laptop', pluralLabel: 'gaming laptops', unitPrice: 2_500 },
      { id: 'phone-laptop-refresh', singularLabel: 'phone-and-laptop refresh', pluralLabel: 'phone-and-laptop refreshes', unitPrice: 3_500 },
      { id: 'preschool-term', singularLabel: 'preschool term', pluralLabel: 'preschool terms', unitPrice: 3_000 },
      { id: 'room-renovation', singularLabel: 'one-room renovation package', pluralLabel: 'one-room renovation packages', unitPrice: 6_000 },
      { id: 'family-holiday', singularLabel: 'annual family holiday', pluralLabel: 'annual family holidays', unitPrice: 5_000 },
      { id: 'medical-buffer', singularLabel: 'hospital cash buffer', pluralLabel: 'hospital cash buffers', unitPrice: 5_000 },
      { id: 'regional-weekend-trip-two', singularLabel: 'regional weekend trip for two', pluralLabel: 'regional weekend trips for two', unitPrice: 1_800 },
      { id: 'road-bike', singularLabel: 'premium road bike', pluralLabel: 'premium road bikes', unitPrice: 4_000 },
      { id: 'home-office-two', singularLabel: 'home-office setup for two', pluralLabel: 'home-office setups for two', unitPrice: 5_000 },
      { id: 'living-room-refresh', singularLabel: 'living-room refresh', pluralLabel: 'living-room refreshes', unitPrice: 4_000 },
    ],
  },
  {
    label: 'S$15k–20k',
    minTotalFees: 15_000,
    maxTotalFees: 20_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'appliance-refresh', singularLabel: 'major appliance refresh', pluralLabel: 'major appliance refreshes', unitPrice: 7_000 },
      { id: 'europe-trip-two', singularLabel: 'short Europe trip for two', pluralLabel: 'short Europe trips for two', unitPrice: 8_000 },
      { id: 'car-down-payment-slice', singularLabel: 'car down-payment slice', pluralLabel: 'car down-payment slices', unitPrice: 10_000 },
      { id: 'kitchen-refresh', singularLabel: 'kitchen refresh package', pluralLabel: 'kitchen refresh packages', unitPrice: 9_000 },
      { id: 'japan-family-airfare', singularLabel: 'Japan airfare for a family of four', pluralLabel: 'Japan airfare packages for a family of four', unitPrice: 4_000 },
      { id: 'household-gadget-refresh', singularLabel: 'household gadget refresh', pluralLabel: 'household gadget refreshes', unitPrice: 6_000 },
      { id: 'premium-laptop-pair', singularLabel: 'pair of premium laptops', pluralLabel: 'pairs of premium laptops', unitPrice: 5_000 },
      { id: 'japan-getaway-two', singularLabel: 'Japan getaway for two', pluralLabel: 'Japan getaways for two', unitPrice: 1_500 },
      { id: 'road-bike', singularLabel: 'premium road bike', pluralLabel: 'premium road bikes', unitPrice: 4_000 },
      { id: 'home-office-chair-pair', singularLabel: 'pair of ergonomic office chairs', pluralLabel: 'pairs of ergonomic office chairs', unitPrice: 1_800 },
      { id: 'room-renovation', singularLabel: 'one-room renovation package', pluralLabel: 'one-room renovation packages', unitPrice: 6_000 },
      { id: 'family-holiday', singularLabel: 'annual family holiday', pluralLabel: 'annual family holidays', unitPrice: 5_000 },
    ],
  },
  {
    label: 'S$20k–30k',
    minTotalFees: 20_000,
    maxTotalFees: 30_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'major-renovation-phase', singularLabel: 'major home-renovation phase', pluralLabel: 'major home-renovation phases', unitPrice: 15_000 },
      { id: 'full-furnishing-package', singularLabel: 'full furnishing package', pluralLabel: 'full furnishing packages', unitPrice: 12_000 },
      { id: 'europe-family-trip', singularLabel: 'short Europe trip for a family', pluralLabel: 'short Europe trips for a family', unitPrice: 12_000 },
      { id: 'full-appliance-refresh', singularLabel: 'full appliance refresh', pluralLabel: 'full appliance refreshes', unitPrice: 8_000 },
      { id: 'medical-emergency-buffer', singularLabel: 'medical emergency buffer', pluralLabel: 'medical emergency buffers', unitPrice: 20_000 },
      { id: 'career-break-buffer', singularLabel: 'career-break buffer', pluralLabel: 'career-break buffers', unitPrice: 15_000 },
      { id: 'family-grocery-year', singularLabel: 'year of family grocery top-ups', pluralLabel: 'years of family grocery top-ups', unitPrice: 12_000 },
      { id: 'used-car', singularLabel: 'small used car purchase', pluralLabel: 'small used car purchases', unitPrice: 28_000 },
      { id: 'resale-flat-refresh', singularLabel: 'resale-flat furnishing refresh', pluralLabel: 'resale-flat furnishing refreshes', unitPrice: 18_000 },
      { id: 'home-down-payment-top-up', singularLabel: 'home down-payment top-up', pluralLabel: 'home down-payment top-ups', unitPrice: 25_000 },
      { id: 'relocation-buffer', singularLabel: 'overseas relocation buffer', pluralLabel: 'overseas relocation buffers', unitPrice: 20_000 },
      { id: 'emergency-fund-chunk', singularLabel: 'emergency-fund chunk', pluralLabel: 'emergency-fund chunks', unitPrice: 25_000 },
    ],
  },
  {
    label: 'S$30k–50k',
    minTotalFees: 30_000,
    maxTotalFees: 50_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'resale-flat-refresh', singularLabel: 'resale-flat furnishing refresh', pluralLabel: 'resale-flat furnishing refreshes', unitPrice: 18_000 },
      { id: 'parental-support-buffer', singularLabel: 'parental-support buffer', pluralLabel: 'parental-support buffers', unitPrice: 15_000 },
      { id: 'home-down-payment-top-up', singularLabel: 'home down-payment top-up', pluralLabel: 'home down-payment top-ups', unitPrice: 25_000 },
      { id: 'relocation-buffer', singularLabel: 'overseas relocation buffer', pluralLabel: 'overseas relocation buffers', unitPrice: 20_000 },
      { id: 'family-travel-budget', singularLabel: 'family travel budget', pluralLabel: 'family travel budgets', unitPrice: 15_000 },
      { id: 'emergency-fund-chunk', singularLabel: 'emergency-fund chunk', pluralLabel: 'emergency-fund chunks', unitPrice: 25_000 },
      { id: 'family-grocery-year', singularLabel: 'year of groceries for a family', pluralLabel: 'years of groceries for a family', unitPrice: 18_000 },
      { id: 'kitchen-wardrobe-renovation', singularLabel: 'full kitchen-and-wardrobe renovation', pluralLabel: 'full kitchen-and-wardrobe renovations', unitPrice: 35_000 },
      { id: 'new-family-car-deposit', singularLabel: 'new family-car down payment', pluralLabel: 'new family-car down payments', unitPrice: 40_000 },
      { id: 'medical-dental-buffer', singularLabel: 'medical-and-dental buffer', pluralLabel: 'medical-and-dental buffers', unitPrice: 20_000 },
      { id: 'rent-contribution-year', singularLabel: 'year of rent contribution', pluralLabel: 'years of rent contribution', unitPrice: 30_000 },
      { id: 'used-car-down-payment', singularLabel: 'used-car down payment', pluralLabel: 'used-car down payments', unitPrice: 35_000 },
    ],
  },
  {
    label: 'S$50k–75k',
    minTotalFees: 50_000,
    maxTotalFees: 75_000,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'extensive-renovation', singularLabel: 'extensive home renovation', pluralLabel: 'extensive home renovations', unitPrice: 50_000 },
      { id: 'family-emergency-fund', singularLabel: 'family emergency fund', pluralLabel: 'family emergency funds', unitPrice: 60_000 },
      { id: 'major-home-repair-fund', singularLabel: 'major home repair fund', pluralLabel: 'major home repair funds', unitPrice: 50_000 },
      { id: 'medical-caregiving-buffer', singularLabel: 'medical-and-caregiving buffer', pluralLabel: 'medical-and-caregiving buffers', unitPrice: 30_000 },
      { id: 'career-break-buffer', singularLabel: 'career-break buffer', pluralLabel: 'career-break buffers', unitPrice: 50_000 },
      { id: 'used-car-down-payment-large', singularLabel: 'used-car down payment', pluralLabel: 'used-car down payments', unitPrice: 40_000 },
      { id: 'overseas-move-reserve', singularLabel: 'overseas move reserve', pluralLabel: 'overseas move reserves', unitPrice: 30_000 },
      { id: 'car-cash-purchase', singularLabel: 'used-car cash purchase', pluralLabel: 'used-car cash purchases', unitPrice: 70_000 },
      { id: 'university-tuition-reserve', singularLabel: 'four-year tuition reserve', pluralLabel: 'four-year tuition reserves', unitPrice: 50_000 },
      { id: 'renovation-plus-furnishing', singularLabel: 'renovation-and-furnishing package', pluralLabel: 'renovation-and-furnishing packages', unitPrice: 60_000 },
      { id: 'portfolio-top-up', singularLabel: 'portfolio top-up', pluralLabel: 'portfolio top-ups', unitPrice: 50_000 },
      { id: 'family-living-buffer', singularLabel: 'family living-cost buffer', pluralLabel: 'family living-cost buffers', unitPrice: 60_000 },
    ],
  },
  {
    label: 'S$75k+',
    minTotalFees: 75_000,
    maxTotalFees: null,
    examples: [
      ...RELATABLE_LOW_DOLLAR_EXAMPLES,
      { id: 'car-cash-purchase', singularLabel: 'used-car cash purchase', pluralLabel: 'used-car cash purchases', unitPrice: 70_000 },
      { id: 'university-tuition-reserve', singularLabel: 'four-year tuition reserve', pluralLabel: 'four-year tuition reserves', unitPrice: 50_000 },
      { id: 'renovation-plus-furnishing', singularLabel: 'renovation-and-furnishing package', pluralLabel: 'renovation-and-furnishing packages', unitPrice: 60_000 },
      { id: 'portfolio-top-up', singularLabel: 'portfolio top-up', pluralLabel: 'portfolio top-ups', unitPrice: 50_000 },
      { id: 'sabbatical-fund', singularLabel: 'sabbatical fund', pluralLabel: 'sabbatical funds', unitPrice: 90_000 },
      { id: 'education-reserve', singularLabel: 'multi-year education reserve', pluralLabel: 'multi-year education reserves', unitPrice: 80_000 },
      { id: 'condo-down-payment-slice', singularLabel: 'condo down-payment slice', pluralLabel: 'condo down-payment slices', unitPrice: 100_000 },
      { id: 'household-living-cost-year', singularLabel: 'year of household living costs', pluralLabel: 'years of household living costs', unitPrice: 80_000 },
      { id: 'major-medical-reserve', singularLabel: 'major medical reserve', pluralLabel: 'major medical reserves', unitPrice: 75_000 },
      { id: 'freedom-fund-slice', singularLabel: 'financial freedom-fund slice', pluralLabel: 'financial freedom-fund slices', unitPrice: 100_000 },
      { id: 'family-flexibility-fund', singularLabel: 'family flexibility fund', pluralLabel: 'family flexibility funds', unitPrice: 85_000 },
      { id: 'caregiver-runway', singularLabel: 'long caregiver runway', pluralLabel: 'long caregiver runways', unitPrice: 90_000 },
    ],
  },
]

const USD_FALLBACK_BAND: IlpFeeYardstickBand = {
  label: 'USD fallback',
  minTotalFees: 0,
  maxTotalFees: null,
  examples: [
    { id: 'coffee', singularLabel: 'coffee', pluralLabel: 'coffees', unitPrice: 4 },
    { id: 'latte', singularLabel: 'cafe latte', pluralLabel: 'cafe lattes', unitPrice: 7 },
    { id: 'lunch', singularLabel: 'lunch out', pluralLabel: 'lunches out', unitPrice: 15 },
    { id: 'burger-meal', singularLabel: 'burger meal', pluralLabel: 'burger meals', unitPrice: 12 },
    { id: 'bubble-tea', singularLabel: 'bubble tea', pluralLabel: 'bubble teas', unitPrice: 6 },
    { id: 'subway-ride', singularLabel: 'subway ride', pluralLabel: 'subway rides', unitPrice: 3 },
    { id: 'rideshare', singularLabel: 'rideshare trip', pluralLabel: 'rideshare trips', unitPrice: 25 },
    { id: 'movie-ticket', singularLabel: 'movie ticket', pluralLabel: 'movie tickets', unitPrice: 18 },
    { id: 'concert-ticket', singularLabel: 'concert ticket', pluralLabel: 'concert tickets', unitPrice: 160 },
    { id: 'gym-membership', singularLabel: 'gym membership', pluralLabel: 'gym memberships', unitPrice: 70 },
    { id: 'grocery-run', singularLabel: 'full grocery run', pluralLabel: 'full grocery runs', unitPrice: 120 },
    { id: 'domestic-flight', singularLabel: 'domestic flight', pluralLabel: 'domestic flights', unitPrice: 250 },
    { id: 'hotel-night', singularLabel: 'hotel night', pluralLabel: 'hotel nights', unitPrice: 220 },
    { id: 'weekend-trip', singularLabel: 'weekend trip', pluralLabel: 'weekend trips', unitPrice: 600 },
    { id: 'iphone', singularLabel: 'new iPhone', pluralLabel: 'new iPhones', unitPrice: 1_000 },
    { id: 'laptop', singularLabel: 'laptop', pluralLabel: 'laptops', unitPrice: 1_400 },
    { id: 'airpods', singularLabel: 'pair of AirPods Pro', pluralLabel: 'pairs of AirPods Pro', unitPrice: 250 },
    { id: 'family-holiday', singularLabel: 'family holiday', pluralLabel: 'family holidays', unitPrice: 4_000 },
    { id: 'car-down-payment', singularLabel: 'car down payment', pluralLabel: 'car down payments', unitPrice: 12_000 },
    { id: 'renovation', singularLabel: 'home renovation', pluralLabel: 'home renovations', unitPrice: 20_000 },
  ],
}

export function formatYardstickNumber(value: number): string {
  return new Intl.NumberFormat('en-SG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)
}

function labelForQuantity(
  quantity: number,
  example: IlpFeeYardstickExample,
  { singular }: { singular?: boolean } = {},
): string {
  if (singular) return example.singularLabel
  return quantity >= 1.5 ? example.pluralLabel : example.singularLabel
}

export function formatYardstickCadence(quantityPerYear: number, example: IlpFeeYardstickExample): string {
  if (quantityPerYear >= 365) {
    return `about ${formatYardstickNumber(quantityPerYear / 365)} ${labelForQuantity(quantityPerYear / 365, example)} a day`
  }

  if (quantityPerYear >= 52) {
    return `about ${formatYardstickNumber(quantityPerYear / 52)} ${labelForQuantity(quantityPerYear / 52, example)} a week`
  }

  if (quantityPerYear >= 12) {
    return `about ${formatYardstickNumber(quantityPerYear / 12)} ${labelForQuantity(quantityPerYear / 12, example)} a month`
  }

  if (quantityPerYear >= 1.5) {
    return `about ${formatYardstickNumber(quantityPerYear)} ${labelForQuantity(quantityPerYear, example)} a year`
  }

  if (quantityPerYear >= 0.85) {
    return `roughly one ${labelForQuantity(quantityPerYear, example, { singular: true })} a year`
  }

  const yearsPerItem = 1 / quantityPerYear
  return `about one ${labelForQuantity(quantityPerYear, example, { singular: true })} every ${formatYardstickNumber(yearsPerItem)} years`
}

export function selectIlpFeeYardstickBand(totalEstimatedFees: number, currency: YardstickCurrency): IlpFeeYardstickBand {
  if (currency === 'USD') return USD_FALLBACK_BAND

  if (totalEstimatedFees <= SGD_YARDSTICK_BANDS[0].minTotalFees) {
    return SGD_YARDSTICK_BANDS[0]
  }

  return SGD_YARDSTICK_BANDS.find((band) => (
    totalEstimatedFees >= band.minTotalFees
    && (band.maxTotalFees == null || totalEstimatedFees < band.maxTotalFees)
  )) ?? SGD_YARDSTICK_BANDS[SGD_YARDSTICK_BANDS.length - 1]
}

export function buildIlpFeeYardstickMatches(
  totalEstimatedFees: number,
  horizonYears: number,
  currency: YardstickCurrency,
): { band: IlpFeeYardstickBand; annualizedCost: number; matches: IlpFeeYardstickMatch[] } | null {
  if (totalEstimatedFees <= 0 || horizonYears <= 0) return null

  const band = selectIlpFeeYardstickBand(totalEstimatedFees, currency)
  const annualizedCost = totalEstimatedFees / horizonYears
  const matches = band.examples.map((example) => {
    const quantityPerYear = annualizedCost / example.unitPrice
    return {
      ...example,
      quantityPerYear,
      sentence: formatYardstickCadence(quantityPerYear, example),
    }
  })

  return { band, annualizedCost, matches }
}

export function getSgdIlpFeeYardstickBands(): IlpFeeYardstickBand[] {
  return SGD_YARDSTICK_BANDS
}
