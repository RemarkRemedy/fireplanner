import { extractPdfText } from '../scripts/ilp-catalog/pdf/extractPdfText.ts'

void (async () => {
  const doc = await extractPdfText('/Users/tj/Downloads/pdfs/GBII_Summary.pdf')
  for (const page of doc.pages) {
    for (const line of page.lines) {
      if (/terminal illness|death benefit|sum insured|aggregate|claim/i.test(line.text)) {
        console.log('p' + page.pageNumber + ': ' + line.text)
      }
    }
  }
})()
