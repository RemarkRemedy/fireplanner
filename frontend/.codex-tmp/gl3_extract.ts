import { extractPdfText } from '../scripts/ilp-catalog/pdf/extractPdfText.ts'

void (async () => {
  const doc = await extractPdfText('/Users/tj/Downloads/pdfs/GL3_Summary.pdf')
  for (const page of doc.pages) {
    for (const line of page.lines) {
      if (/death benefit|net premium|age 65|all net premium/i.test(line.text)) {
        console.log('p' + page.pageNumber + ': ' + line.text)
      }
    }
  }
})()
