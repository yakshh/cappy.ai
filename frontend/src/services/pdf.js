import { ocrImage } from './ai/gemini'

const MIN_NATIVE_CHARS = 30    // below this a page is treated as scanned or handwritten
const MIN_OCR_CONFIDENCE = 60  // Tesseract confidence (0-100) below which Gemini double-checks the page
const OCR_MAX_SIDE = 2200      // longest side in pixels when a page is drawn for OCR
const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

let pdfjsPromise
function loadPdfjs() {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import('pdfjs-dist')
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsPromise
}

/**
 * Read a PDF in the browser, page by page.
 *   Tier 1: the PDF's own text layer (pdf.js)
 *   Tier 2: Tesseract OCR in the browser (free, unlimited) for scanned pages
 *   Tier 3: Gemini vision for pages Tesseract is unsure about, such as handwriting
 *
 * Returns { pages, stats } where stats counts how each page was read.
 */
export async function extractPdfPages(file, onProgress) {
  const pdfjs = await loadPdfjs()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise

  const pages = []
  const stats = { total: pdf.numPages, text: 0, ocr: 0, ai_ocr: 0, skipped: 0 }
  let ocrWorker = null

  try {
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      const content = await page.getTextContent()
      let text = content.items
        .map((item) => item.str + (item.hasEOL ? '\n' : ' '))
        .join('')
        .replace(/[ \t]+/g, ' ')
        .trim()

      if (text.length >= MIN_NATIVE_CHARS) {
        stats.text++
      } else {
        const canvas = await renderPage(page)
        ocrWorker ??= await createOcrWorker()
        const local = await runTesseract(ocrWorker, canvas)

        if (local.text.length >= MIN_NATIVE_CHARS && local.confidence >= MIN_OCR_CONFIDENCE) {
          text = local.text
          stats.ocr++
        } else {
          const ai = await ocrImage(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
          if (ai.length >= 10) {
            text = ai
            stats.ai_ocr++
          } else if (local.text.length >= 10) {
            text = local.text // Gemini unavailable: a rough read is better than losing the page
            stats.ocr++
          }
        }
        canvas.width = canvas.height = 0 // free the bitmap
      }

      if (text) pages.push({ page: n, text })
      else stats.skipped++
      onProgress?.(n / pdf.numPages)
    }
  } finally {
    await ocrWorker?.terminate()
  }
  return { pages, stats }
}

async function renderPage(page) {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2, OCR_MAX_SIDE / Math.max(base.width, base.height))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

async function createOcrWorker() {
  const { createWorker } = await import('tesseract.js')
  return createWorker('eng')
}

async function runTesseract(worker, canvas) {
  try {
    const { data } = await worker.recognize(canvas)
    return { text: data.text.replace(/[ \t]+/g, ' ').trim(), confidence: data.confidence }
  } catch (err) {
    console.warn('[OCR] Tesseract failed:', err.message)
    return { text: '', confidence: 0 }
  }
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
