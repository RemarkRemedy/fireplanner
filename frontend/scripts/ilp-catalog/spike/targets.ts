export interface SpikeTarget {
  id: string
  insurer: string
  productName: string
  sourcePath: string
}

export const SPIKE_TARGETS: SpikeTarget[] = [
  {
    id: 'hsbc-wealth-accelerate',
    insurer: 'HSBC Life',
    productName: 'Wealth Accelerate',
    sourcePath: '/Users/tj/Downloads/pdfs/HSBC Life Wealth Accelerate Product Summary.pdf',
  },
  {
    id: 'prudential-pruvantage-wealth-ii',
    insurer: 'Prudential',
    productName: 'PRUVantage Wealth II',
    sourcePath: '/Users/tj/Downloads/pdfs/PRUVantage Wealth II Product Summary.pdf',
  },
  {
    id: 'etiqa-invest-flex-prime-ii',
    insurer: 'Etiqa',
    productName: 'Invest flex prime II',
    sourcePath: '/Users/tj/Downloads/pdfs/EIP_Invest flex prime II_Product Summary.pdf',
  },
  {
    id: 'fwd-invest-first-horizon',
    insurer: 'FWD',
    productName: 'Invest First Horizon',
    sourcePath: '/Users/tj/Downloads/pdfs/FWD Invest First Horizon Product Summary.pdf',
  },
  {
    id: 'tokio-marine-unzv',
    insurer: 'Tokio Marine',
    productName: 'TML_UNZV_TPDN_CIZ',
    sourcePath: '/Users/tj/Downloads/pdfs/TML_UNZV_TPDN_CIZ_Summary.pdf',
  },
]
