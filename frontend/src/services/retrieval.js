import { collection, doc, getDoc, getDocs, query as fsQuery, where } from 'firebase/firestore'
import { db } from '../firebase'

// Chunks of one PDF are stored ~BLOCK_SIZE per Firestore document, so loading a
// whole PDF costs a handful of reads instead of one read per chunk.
export const BLOCK_SIZE = 150

const STOPWORDS = new Set(
  'the and for are but not you all any can had her was one our out has have this that with from they will what when your how why who into than then them these those about which their there would could should'.split(' ')
)

const docsRef = (uid) => collection(db, 'users', uid, 'documents')
const blocksRef = (uid, docId) => collection(db, 'users', uid, 'documents', docId, 'blocks')

// Per-session cache: blocks only change on upload/delete, so re-reading them is wasted quota.
const chunkCache = new Map()

export function forgetDocument(docId) {
  chunkCache.delete(docId)
}

export function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 2 && !STOPWORDS.has(t))
}

/** Ready documents among `ids` (or all ready documents when `ids` is empty). */
export async function getReadyDocuments(uid, ids) {
  let docs
  if (ids?.length) {
    const snaps = await Promise.all(ids.map((id) => getDoc(doc(db, 'users', uid, 'documents', id))))
    docs = snaps.filter((s) => s.exists()).map((s) => ({ id: s.id, ...s.data() }))
  } else {
    const snap = await getDocs(fsQuery(docsRef(uid), where('status', '==', 'ready')))
    docs = snap.docs.map((s) => ({ id: s.id, ...s.data() }))
  }
  return docs.filter((d) => d.status === 'ready')
}

async function loadChunks(uid, document) {
  if (chunkCache.has(document.id)) return chunkCache.get(document.id)
  const snap = await getDocs(blocksRef(uid, document.id))
  const chunks = snap.docs
    .flatMap((b) => b.data().chunks)
    .map((c) => ({
      document_id: document.id,
      document_name: document.filename,
      page: c.page,
      chunk_index: c.i,
      text: c.text,
    }))
    .sort((a, b) => a.chunk_index - b.chunk_index)
  chunkCache.set(document.id, chunks)
  return chunks
}

const shuffle = (list) => {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Pick the `n` most useful chunks from `documents`.
 *  - `queryText` empty: a random spread across the notes (for summaries, quizzes, papers)
 *  - otherwise: BM25 keyword ranking
 * `varied` mixes the top 2n hits so repeated generations are not identical.
 * Search passes `varied: false` and gets strictly ranked results with a relevance score.
 */
export async function retrieve(uid, documents, { queryText = '', n = 5, varied = true } = {}) {
  const all = (await Promise.all(documents.map((d) => loadChunks(uid, d)))).flat()
  if (!all.length) return []

  const terms = [...new Set(tokenize(queryText))]
  if (!terms.length) {
    return shuffle(all).slice(0, n).map((c) => ({ ...c, score: 0.5 }))
  }

  // BM25 over the loaded chunks
  const k1 = 1.5
  const b = 0.75
  const tokenized = all.map((c) => tokenize(c.text))
  const avgLen = tokenized.reduce((s, t) => s + t.length, 0) / all.length || 1
  const df = Object.fromEntries(terms.map((t) => [t, tokenized.filter((tk) => tk.includes(t)).length]))
  const phrase = queryText.trim().toLowerCase()

  const scored = all.map((chunk, idx) => {
    const tokens = tokenized[idx]
    const tf = {}
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1

    let bm25 = 0
    let matched = 0
    for (const t of terms) {
      if (!tf[t]) continue
      matched++
      const idf = Math.log(1 + (all.length - df[t] + 0.5) / (df[t] + 0.5))
      bm25 += (idf * tf[t] * (k1 + 1)) / (tf[t] + k1 * (1 - b + (b * tokens.length) / avgLen))
    }

    // Relevance shown to the user: share of query words found, plus a bonus for the exact phrase.
    let score = matched / terms.length
    if (matched && phrase.length > 3 && chunk.text.toLowerCase().includes(phrase)) score = Math.min(1, score + 0.35)
    return { chunk, bm25, score }
  })

  const hits = scored
    .filter((s) => s.bm25 > 0 && s.score >= 0.1)
    .sort((x, y) => y.bm25 - x.bm25)
    .map((s) => ({ ...s.chunk, score: Math.round(s.score * 10000) / 10000 }))

  if (!varied) return hits.slice(0, n)
  // Generation features still get material when a topic matches nothing.
  if (!hits.length) return shuffle(all).slice(0, n).map((c) => ({ ...c, score: 0.5 }))
  return shuffle(hits.slice(0, n * 2)).slice(0, n)
}
