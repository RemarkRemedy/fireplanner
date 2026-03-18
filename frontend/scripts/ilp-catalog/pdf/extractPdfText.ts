import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const STANDARD_FONT_DATA_URL = new URL(
  '../../../node_modules/pdfjs-dist/standard_fonts/',
  import.meta.url,
).href

export interface ExtractedPdfLine {
  y: number
  text: string
}

export interface ExtractedPdfPage {
  pageNumber: number
  lines: ExtractedPdfLine[]
  text: string
  characterCount: number
}

export interface ExtractedPdfDocument {
  filePath: string
  pageCount: number
  pages: ExtractedPdfPage[]
  totalCharacters: number
}

interface TextItemLike {
  str?: string
  transform?: number[]
}

function isTextItem(item: unknown): item is TextItemLike {
  return !!item && typeof item === 'object' && 'str' in item
}

function normalizeLineText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:%\)])/, '$1')
    .replace(/([\(\$])\s+/g, '$1')
    .trim()
}

function buildLines(items: unknown[]): ExtractedPdfLine[] {
  const positioned = items
    .filter(isTextItem)
    .map((item) => ({
      text: typeof item.str === 'string' ? item.str : '',
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
    }))
    .filter((item) => item.text.trim().length > 0)
    .sort((left, right) => {
      if (Math.abs(right.y - left.y) > 1.5) {
        return right.y - left.y
      }

      return left.x - right.x
    })

  const lines: Array<{ y: number, parts: string[] }> = []

  for (const item of positioned) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2)
    if (line) {
      line.parts.push(item.text)
    } else {
      lines.push({ y: item.y, parts: [item.text] })
    }
  }

  return lines
    .map((line) => ({
      y: line.y,
      text: normalizeLineText(line.parts.join(' ')),
    }))
    .filter((line) => line.text.length > 0)
}

export async function extractPdfText(filePath: string): Promise<ExtractedPdfDocument> {
  const data = new Uint8Array(await readFile(filePath))
  const loadingTask = getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  })
  const pdf = await loadingTask.promise
  const pages: ExtractedPdfPage[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const lines = buildLines(content.items)
    const text = lines.map((line) => line.text).join('\n')

    pages.push({
      pageNumber,
      lines,
      text,
      characterCount: text.replace(/\s+/g, '').length,
    })
  }

  const totalCharacters = pages.reduce((sum, page) => sum + page.characterCount, 0)

  return {
    filePath,
    pageCount: pdf.numPages,
    pages,
    totalCharacters,
  }
}
