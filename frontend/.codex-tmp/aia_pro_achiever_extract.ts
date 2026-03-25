import { extractPdfText } from '../scripts/ilp-catalog/pdf/extractPdfText.ts'

void (async () => {
  const doc = await extractPdfText('/Users/tj/Downloads/pdfs/AIA_Pro_Achiever_3_Summary.pdf')
  for (const pageNumber of [5, 14]) {
    const page = doc.pages.find((p) => p.pageNumber === pageNumber)
    if (!page) continue
    console.log('=== PAGE ' + pageNumber + ' ===')
    page.lines.forEach((line, index) => {
      if (/Benefit Charge|Premium Pass|Premium Holiday|Premium Reduction|Premium Reward|Supplementary Charge/i.test(line.text)) {
        const start = Math.max(0, index - 3)
        const end = Math.min(page.lines.length, index + 5)
        console.log('---')
        for (let i = start; i < end; i += 1) {
          console.log(String(i).padStart(3, ' ') + ': ' + page.lines[i].text)
        }
      }
    })
  }
})()
