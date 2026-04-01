/** Shared constants for all ILP blog interactive components */

// PA Rate Visualizer defaults
export const DEFAULT_PA_RATE = 0.30;        // 30%
export const MIN_PA_RATE = 0.20;            // 20%
export const MAX_PA_RATE = 1.0;             // 100%
export const DEFAULT_MONTHLY_PREMIUM = 200; // $200

// Fee Comparison Slider assumptions
export const ILP_FEE_RATE = 0.013;          // 1.3% default (best-case modern ILP)
export const ILP_FEE_OPTIONS = [
  { label: '1.3%', value: 0.013, description: 'Low-cost ILP' },
  { label: '2.0%', value: 0.02, description: 'Mid-range ILP' },
  { label: '3.0%', value: 0.03, description: 'Traditional ILP' },
  { label: '3.5%', value: 0.035, description: 'High-fee ILP' },
] as const;
export const TERM_LIFE_MONTHLY = 30;        // $30/mo
export const ETF_EXPENSE_RATIO = 0.0022;    // 0.22% (VWRA)
export const EXPECTED_ANNUAL_RETURN = 0.06; // 6% nominal
export const POLICY_TERMS = [15, 20, 25, 30] as const;
export const DEFAULT_POLICY_TERM = 25;

// Quiz
export const QUIZ_QUESTION_COUNT = 6;
export const QUIZ_RESULT_TIERS = {
  HIGH: { min: 5, max: 6 }, // "you might prefer DIY"
  MID: { min: 3, max: 4 },  // "could go either way"
  LOW: { min: 0, max: 2 },  // "ILP may help discipline"
} as const;

// Shared branding
export const SITE_URL = 'sgfireplanner.com/ilp';
export const CALCULATOR_PATH = '/ilp-fees';

// Disclaimer text (no em dashes, per project convention)
export const FEE_DISCLAIMER =
  'Fee and premium figures are illustrative. ILP all-in fees range from ~1.3% to 3.5%+ depending on the product. The slider uses 2% as a mid-range estimate. Term life premium ($30/mo) is based on a healthy non-smoker in their 20s for ~$200K coverage. Your actual figures will vary.';
export const QUIZ_DISCLAIMER =
  'This checklist is for educational purposes. It does not constitute financial advice.';
