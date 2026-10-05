import { getGenerativeModel } from 'firebase/ai'
import { ai } from '../../firebase'
import { apiError } from '../errors'

// Change this one constant to move every feature to a different Gemini model.
export const GEMINI_MODEL = 'gemini-2.5-flash'

function modelFor({ json }) {
  return getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 8192,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  })
}

function aiError(err) {
  const msg = String(err?.message || err)
  console.warn('[AI]', msg)
  if (/429|quota|rate/i.test(msg)) {
    return apiError('The AI is busy right now (free quota reached). Please try again in a minute.', 429)
  }
  if (/App Check/i.test(msg)) {
    return apiError('AI request was blocked by App Check. Check the App Check setup for this site.', 401)
  }
  if (/403|PERMISSION|not enabled|API key/i.test(msg)) {
    return apiError('AI is not enabled for this project. Enable Firebase AI Logic in the Firebase console.', 503)
  }
  return apiError('AI generation failed. Please try again.', 503)
}

async function run(model, parts) {
  try {
    const result = await model.generateContent(parts)
    const text = result.response.text()
    if (!text || !text.trim()) throw new Error('Empty response from Gemini.')
    return text.trim()
  } catch (err) {
    throw aiError(err)
  }
}

export const generateText = (prompt) => run(modelFor({ json: false }), prompt)
export const generateJson = (prompt) => run(modelFor({ json: true }), prompt)

/** Transcribe a scanned or handwritten page. Returns '' on failure so one bad page never aborts an upload. */
export async function ocrImage(base64Jpeg) {
  const prompt =
    'Transcribe all text from this study document page accurately. ' +
    'Include printed text, handwritten notes, mathematical formulas, and diagram labels. ' +
    'Return ONLY the extracted text content without explanations.'
  try {
    return await run(modelFor({ json: false }), [
      { inlineData: { mimeType: 'image/jpeg', data: base64Jpeg } },
      { text: prompt },
    ])
  } catch (err) {
    console.warn('[OCR] page skipped:', err.message)
    return ''
  }
}

/** Parse JSON from an LLM reply, repairing code fences, trailing commas and truncated arrays. */
export function parseJsonRobust(raw) {
  let text = String(raw).trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) text = fenced[1].trim()

  const attempts = [
    () => JSON.parse(text),
    () => JSON.parse(text.replace(/,\s*([\]}])/g, '$1')),
    () => {
      const arr = text.match(/\[[\s\S]*/)
      const end = arr ? arr[0].lastIndexOf('}') : -1
      if (end === -1) throw new Error('no array')
      return JSON.parse((arr[0].slice(0, end + 1) + ']').replace(/,\s*\]/g, ']'))
    },
    () => {
      const obj = text.match(/\{[\s\S]*/)
      const end = obj ? obj[0].lastIndexOf('}') : -1
      if (end === -1) throw new Error('no object')
      return JSON.parse(obj[0].slice(0, end + 1))
    },
  ]

  for (const attempt of attempts) {
    try {
      const parsed = attempt()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if ('university' in parsed || 'examination' in parsed || 'solutions' in parsed) return parsed
        for (const key of ['questions', 'flashcards', 'cards', 'items', 'data']) {
          if (Array.isArray(parsed[key])) return parsed[key]
        }
      }
      return parsed
    } catch {
      // try the next repair strategy
    }
  }
  throw new Error('Failed to parse valid JSON from AI output.')
}
