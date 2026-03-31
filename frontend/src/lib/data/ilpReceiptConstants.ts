/** Fixed assumptions for the index fund comparison on ILP receipts. */
export const INDEX_FUND_GROSS_RETURN = 0.07
export const INDEX_FUND_FEE_DRAG = 0.003
export const INDEX_FUND_NET_RETURN = INDEX_FUND_GROSS_RETURN - INDEX_FUND_FEE_DRAG

/** Receipt pixel dimensions by format. */
export const RECEIPT_DIMENSIONS = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
} as const

export type ReceiptFormat = keyof typeof RECEIPT_DIMENSIONS
