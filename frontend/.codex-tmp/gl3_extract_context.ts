import { extractPdfText } from '../scripts/ilp-catalog/pdf/extractPdfText.ts'

void (async () => {
  const doc = await extractPdfText('/Users/tj/Downloads/pdfs/GL3_Summary.pdf')
  const page = doc.pages.find((p) => p.pageNumber === 2)
  if (!page) return
  page.lines.forEach((line, index) => {
    if (/death benefit|net premium|anniversary immediately after|accidental death/i.test(line.text)) {
      const start = Math.max(0, index - 3)
      const end = Math.min(page.lines.length, index + 4)
      console.log('---')
      for (let i = start; i < end; i += 1) {
        console.log(String(i).padStart(3,' ') + ': ' + page.lines[i].text)
      }
    }
  })
})()
