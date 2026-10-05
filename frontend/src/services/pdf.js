import { ocrImage } from './ai/gemini'

const MIN_NATIVE_CHARS = 30   // below this a page is treated as scanned/handwritten
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

/**
 * Read a PDF in the browser, page by page.
 *   Tier 1: the PDF's own text layer (pdf.js)
 *   Tier 2: Gemini vision for scanned or handwritten pages
 */
export async function extractPdfPages(file, onProgress) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  const pages = []

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const content = await page.getTextContent()
    let text = content.items
      .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
      .join('')
      .replace(/[ \t]+/g, ' ')
      .trim()

    if (text.length < MIN_NATIVE_CHARS) {
      const scanned = await ocrImage(await renderPageToJpeg(page))
      if (scanned) text = scanned
    }

    if (text) pages.push({ page: n, text })
    onProgress?.(n, pdf.numPages)
  }
  return pages
}

async function renderPageToJpeg(page) {
  const viewport = page.getViewport({ scale: 1.6 })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
}

/** Split page texts into overlapping chunks that remember their page number. */
export function chunkPages(pages) {
  const chunks = []
  for (const { page, text } of pages) {
    for (let start = 0; start < text.length; start += CHUNK_SIZE - CHUNK_OVERLAP) {
      const piece = text.slice(start, start + CHUNK_SIZE).trim()
      if (piece) chunks.push({ page, text: piece })
      if (start + CHUNK_SIZE >= text.length) break
    }
  }
  return chunks.map((c, i) => ({ i, ...c }))
}
