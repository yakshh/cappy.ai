import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateAuthProfile,
} from 'firebase/auth'
import {
  Bytes,
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { apiError, toApiError } from './errors'
import { chunkPages, extractPdfPages } from './pdf'
import { BLOCK_SIZE, forgetDocument, getReadyDocuments, retrieve } from './retrieval'
import {
  generateAnswer,
  generateFlashcards,
  generateQuiz,
  generateSamplePaper,
  generateSummary,
  solveQuestionPaper,
} from './ai/prompts'

// Services keep the shapes the pages already use: promises resolving to `{ data }`
// and rejecting with `err.response.data.detail`.

const DAILY_PAPER_SOLVE_LIMIT = 7
const now = () => new Date().toISOString()
const wrap = (fn, fallback) => async (...args) => {
  try {
    return { data: await fn(...args) }
  } catch (err) {
    throw toApiError(err, fallback)
  }
}

function uid() {
  const id = auth.currentUser?.uid
  if (!id) throw apiError('Please log in again.', 401)
  return id
}

const userDoc = (id) => doc(db, 'users', id)
const col = (...path) => collection(db, 'users', uid(), ...path)
const ref = (...path) => doc(db, 'users', uid(), ...path)

// ── Auth & profile ─────────────────────────────────────────────────────────────

export async function loadProfile(fbUser) {
  const snap = await getDoc(userDoc(fbUser.uid))
  const profile = snap.exists() ? snap.data() : {}
  const studyField = profile.study_field ?? profile.field ?? ''

  // Records made before the readable layout get the email and the clearer field name added.
  if (snap.exists() && (!profile.email || profile.field !== undefined)) {
    setDoc(
      userDoc(fbUser.uid),
      { email: fbUser.email, study_field: studyField, field: deleteField() },
      { merge: true }
    ).catch(() => {})
  }

  return {
    id: fbUser.uid,
    full_name: profile.full_name || fbUser.displayName || '',
    email: fbUser.email,
    field: studyField,
    avatar_url: profile.avatar_url || null,
    created_at: profile.created_at || fbUser.metadata.creationTime,
  }
}

export const authService = {
  register: wrap(async ({ full_name, email, password, field }) => {
    const name = full_name.trim()
    const stream = field?.trim()
    if (!name) throw apiError('Please provide your full name.', 422)
    if (!stream) throw apiError('Please provide your Field / Stream of study.', 422)
    if (password.length < 8) throw apiError('Password must be at least 8 characters.', 422)

    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
    await updateAuthProfile(user, { displayName: name })
    await setDoc(userDoc(user.uid), {
      full_name: name,
      email: user.email,
      study_field: stream,
      created_at: now(),
    })
    return { user: await loadProfile(user) }
  }, 'Registration failed'),

  login: wrap(async ({ email, password }) => {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password)
    return { user: await loadProfile(user) }
  }, 'Login failed'),

  logout: () => signOut(auth),

  // The email address is the Firebase login identity, so only name and field are editable.
  updateProfile: wrap(async ({ full_name, field }) => {
    const changes = {}
    if (full_name?.trim()) changes.full_name = full_name.trim()
    if (field !== undefined) changes.study_field = field.trim()
    await setDoc(userDoc(uid()), { ...changes, field: deleteField() }, { merge: true })
    if (changes.full_name) await updateAuthProfile(auth.currentUser, { displayName: changes.full_name })
    // The pages still call this value `field`.
    return { ...(changes.full_name && { full_name: changes.full_name }), ...(field !== undefined && { field: changes.study_field }) }
  }, 'Update failed'),

  changePassword: wrap(async ({ current_password, new_password }) => {
    if (new_password.length < 8) throw apiError('New password must be at least 8 characters.', 422)
    const user = auth.currentUser
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current_password))
    } catch {
      throw apiError('Current password is incorrect.', 401)
    }
    await updatePassword(user, new_password)
    return { message: 'Password updated successfully.' }
  }, 'Password update failed'),
}

// ── Documents ──────────────────────────────────────────────────────────────────

const MAX_PDF_BYTES = 10 * 1024 * 1024
// A Firestore field holds at most ~1 MiB, so the original PDF is stored as 900 KB pieces.
// This keeps the original file free, using the shared 1 GiB Firestore allowance.
const FILE_PIECE_BYTES = 900 * 1024
const pieceId = (n) => String(n).padStart(4, '0')

const asDocument = (snap) => ({ id: snap.id, ...snap.data() })

// Uploads run in the browser, so a document still "processing" long after it started was interrupted.
const STALE_PROCESSING_MS = 15 * 60 * 1000
const asListedDocument = (snap) => {
  const d = asDocument(snap)
  if (d.status === 'processing' && Date.now() - new Date(d.created_at).getTime() > STALE_PROCESSING_MS) {
    d.status = 'failed'
  }
  return d
}

export const documentService = {
  list: wrap(async () => {
    const snap = await getDocs(query(col('documents'), orderBy('created_at', 'desc')))
    return snap.docs.map(asListedDocument)
  }, 'Could not load documents'),

  get: wrap(async (id) => {
    const snap = await getDoc(ref('documents', id))
    if (!snap.exists()) throw apiError('Document not found.', 404)
    return asDocument(snap)
  }),

  /**
   * Read a PDF in the browser (OCR for scanned pages), save its text as searchable chunks,
   * and keep the original file. `onProgress` receives 0..1. Returns the new document.
   */
  upload: wrap(async (file, onProgress) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) throw apiError('Only PDF files are allowed.', 415)
    if (file.size > MAX_PDF_BYTES) throw apiError('PDF is larger than 10 MB.', 413)

    const docRef = doc(col('documents'))
    const meta = {
      filename: file.name,
      file_size: file.size,
      page_count: 0,
      chunk_count: 0,
      status: 'processing',
      category: 'General',
      created_at: now(),
    }
    await setDoc(docRef, meta)

    try {
      const { pages, stats } = await extractPdfPages(file, (fraction) => onProgress?.(fraction * 0.75))
      const chunks = chunkPages(pages)
      if (!chunks.length) throw apiError('No readable text found in this PDF.', 422)

      const bytes = new Uint8Array(await file.arrayBuffer())
      const pieces = Math.ceil(bytes.length / FILE_PIECE_BYTES)
      for (let n = 0; n < pieces; n++) {
        const part = bytes.subarray(n * FILE_PIECE_BYTES, (n + 1) * FILE_PIECE_BYTES)
        await setDoc(doc(docRef, 'files', pieceId(n)), { data: Bytes.fromUint8Array(part) })
        onProgress?.(0.75 + 0.2 * ((n + 1) / pieces))
      }

      const batch = writeBatch(db)
      for (let start = 0, n = 0; start < chunks.length; start += BLOCK_SIZE, n++) {
        batch.set(doc(docRef, 'blocks', String(n).padStart(4, '0')), {
          chunks: chunks.slice(start, start + BLOCK_SIZE),
        })
      }
      Object.assign(meta, {
        page_count: stats.total,
        chunk_count: chunks.length,
        ocr_pages: stats.ocr + stats.ai_ocr,
        has_original: true,
        original_pieces: pieces,
        status: 'ready',
      })
      batch.update(docRef, meta)
      await batch.commit()
      onProgress?.(1)
    } catch (err) {
      await updateDoc(docRef, { status: 'failed' }).catch(() => {})
      throw err
    }
    return { id: docRef.id, ...meta }
  }, 'Upload failed'),

  delete: wrap(async (id) => {
    const docRef = ref('documents', id)
    const [blocks, files] = await Promise.all([getDocs(collection(docRef, 'blocks')), getDocs(collection(docRef, 'files'))])
    const batch = writeBatch(db)
    ;[...blocks.docs, ...files.docs].forEach((d) => batch.delete(d.ref))
    batch.delete(docRef)
    await batch.commit()
    forgetDocument(id)
    return { message: 'Document deleted successfully.', id }
  }, 'Delete failed'),

  /** Save the original PDF back to the computer. */
  download: wrap(async (id, filename) => {
    const snap = await getDocs(query(collection(ref('documents', id), 'files'), orderBy('__name__')))
    if (snap.empty) throw apiError('The original file was not saved for this document.', 404)
    const blob = new Blob(snap.docs.map((d) => d.data().data.toUint8Array()), { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href: url, download: filename })
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return { id }
  }, 'Download failed'),

  updateCategory: wrap(async (id, category) => {
    const next = category.trim() || 'General'
    await updateDoc(ref('documents', id), { category: next })
    return { id, category: next }
  }),
}

// ── Chat ───────────────────────────────────────────────────────────────────────

export const chatService = {
  sendMessage: wrap(async ({ question, conversation_id, document_ids }) => {
    const text = question.trim()
    if (!text) throw apiError('Question cannot be empty.', 422)

    const documents = await getReadyDocuments(uid(), document_ids)
    const chunks = await retrieve(uid(), documents, { queryText: text, n: 5 })
    const { answer, sources } = await generateAnswer(text, chunks)

    let convRef
    if (conversation_id) {
      convRef = ref('conversations', conversation_id)
      if (!(await getDoc(convRef)).exists()) throw apiError('Conversation not found.', 404)
      await updateDoc(convRef, { updated_at: now() })
    } else {
      convRef = doc(col('conversations'))
      await setDoc(convRef, {
        title: text.length > 60 ? `${text.slice(0, 60)}...` : text,
        created_at: now(),
        updated_at: now(),
      })
    }

    const messages = collection(convRef, 'messages')
    await addDoc(messages, { role: 'user', content: text, sources: [], created_at: now() })
    const reply = await addDoc(messages, {
      role: 'assistant',
      content: answer,
      sources,
      created_at: new Date(Date.now() + 1).toISOString(), // sorts after the question
    })
    return { answer, sources, conversation_id: convRef.id, message_id: reply.id }
  }, 'Chat failed'),

  getConversations: wrap(async () => {
    const snap = await getDocs(query(col('conversations'), orderBy('updated_at', 'desc')))
    return snap.docs.map(asDocument)
  }),

  getMessages: wrap(async (id) => {
    const convRef = ref('conversations', id)
    const conv = await getDoc(convRef)
    if (!conv.exists()) throw apiError('Conversation not found.', 404)
    const snap = await getDocs(query(collection(convRef, 'messages'), orderBy('created_at', 'asc')))
    return { conversation_id: id, title: conv.data().title, messages: snap.docs.map(asDocument) }
  }),

  deleteConversation: wrap(async (id) => {
    const convRef = ref('conversations', id)
    const messages = await getDocs(collection(convRef, 'messages'))
    const batch = writeBatch(db)
    messages.docs.forEach((m) => batch.delete(m.ref))
    batch.delete(convRef)
    await batch.commit()
  }),
}

// ── Study tools ────────────────────────────────────────────────────────────────

async function readyDocsOrThrow(ids) {
  const documents = await getReadyDocuments(uid(), ids)
  if (!documents.length) throw apiError('No ready documents found.', 404)
  return documents
}

async function notesFor(documents, queryText, n) {
  const chunks = await retrieve(uid(), documents, { queryText, n })
  if (!chunks.length) throw apiError('No content found in selected documents.', 404)
  return { chunks, text: chunks.map((c) => c.text).join('\n\n') }
}

const brief = (documents) => documents.map((d) => ({ id: d.id, filename: d.filename }))

export const summaryService = {
  generate: wrap(async ({ document_ids, mode = 'short', topic }) => {
    if (!['short', 'detailed', 'bullets'].includes(mode)) {
      throw apiError('mode must be: short, detailed, or bullets', 422)
    }
    const documents = await readyDocsOrThrow(document_ids)
    const { chunks, text } = await notesFor(documents, topic, 15)
    const summary = await generateSummary(text, mode, topic)
    return { summary, mode, documents: brief(documents), chunks_used: chunks.length }
  }, 'Summary failed'),
}

export const quizService = {
  generate: wrap(async ({ document_ids, quiz_type = 'mcq', num_questions = 5, topic }) => {
    if (!['mcq', 'flashcards'].includes(quiz_type)) throw apiError('quiz_type must be mcq or flashcards', 422)
    if (!(num_questions >= 1 && num_questions <= 30)) throw apiError('num_questions must be between 1 and 30.', 422)

    const documents = await readyDocsOrThrow(document_ids)
    const { text } = await notesFor(documents, topic, 5)
    const questions =
      quiz_type === 'flashcards'
        ? await generateFlashcards(text, num_questions)
        : await generateQuiz(text, num_questions)
    return { quiz_type, num_questions: questions.length, questions, documents: brief(documents) }
  }, 'Quiz failed'),
}

export const flashcardService = {
  generate: wrap(async ({ document_ids, num_cards = 10, topic }) => {
    if (!(num_cards >= 1 && num_cards <= 30)) throw apiError('num_cards must be between 1 and 30.', 422)
    const documents = await readyDocsOrThrow(document_ids)
    const { text } = await notesFor(documents, topic, 5)
    const flashcards = await generateFlashcards(text, num_cards)
    return { num_cards: flashcards.length, flashcards, documents: brief(documents) }
  }, 'Flashcards failed'),
}

export const searchService = {
  search: wrap(async ({ query: queryText, document_ids, n_results = 10 }) => {
    if (!queryText.trim()) throw apiError('Query cannot be empty.', 422)
    const documents = await getReadyDocuments(uid(), document_ids)
    const results = await retrieve(uid(), documents, { queryText, n: n_results, varied: false })
    return { query: queryText, total_results: results.length, results }
  }, 'Search failed'),
}

// ── Sample papers ──────────────────────────────────────────────────────────────

/** Count one paper solve against today's quota (UTC day), or fail with 429. */
async function useDailySolve() {
  const day = new Date().toISOString().slice(0, 10)
  const usageRef = ref('usage', day)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(usageRef)
    const count = snap.exists() ? snap.data().solve_count : 0
    if (count >= DAILY_PAPER_SOLVE_LIMIT) {
      throw apiError(
        `Daily limit reached! You can solve up to ${DAILY_PAPER_SOLVE_LIMIT} question papers per day.`,
        429
      )
    }
    tx.set(usageRef, { solve_count: count + 1 })
  })
}

async function pdfText(file) {
  const { pages } = await extractPdfPages(file)
  return pages.map((p) => p.text).join('\n')
}

export const samplePaperService = {
  generate: wrap(async (data) => {
    const documents = await readyDocsOrThrow(data.document_ids)
    const subjectName = data.subject_name || 'IOT and Applications'
    const { text } = await notesFor(
      documents,
      `${subjectName} key concepts principles applications architectures algorithms protocols security`,
      5
    )

    const paper = await generateSamplePaper(text, {
      universityName: data.university_name || 'UNIVERSITY EXAMINATION',
      subjectCode: data.subject_code || '3160716',
      subjectName,
      examTerm: data.exam_term || 'SUMMER 2024',
      totalMarks: data.total_marks || 70,
    })

    // Saved so the same paper can be solved later by its ID, without re-reading the PDF.
    paper.paper_id = crypto.randomUUID().slice(0, 8)
    await setDoc(ref('papers', paper.paper_id), {
      content: paper.raw_markdown || paper.content || '',
      created_at: now(),
    })
    return { paper, documents: brief(documents) }
  }, 'Paper generation failed'),

  solveUpload: wrap(async (formData) => {
    const file = formData.get('file')
    const documentIds = formData.getAll('document_ids')
    const subjectName = formData.get('subject_name') || 'Subject Exam'
    if (!file?.name?.toLowerCase().endsWith('.pdf')) throw apiError('Only PDF files are allowed.', 400)

    const documents = await readyDocsOrThrow(documentIds)
    await useDailySolve()

    // Papers generated by this app are named "...ID-<paperId>.pdf"; reuse the saved text.
    let paperText = ''
    const match = file.name.match(/ID-([a-zA-Z0-9]+)\.pdf/i)
    if (match) {
      const saved = await getDoc(ref('papers', match[1]))
      if (saved.exists()) paperText = saved.data().content
    }
    if (!paperText) paperText = await pdfText(file)
    if (!paperText.trim()) throw apiError('No readable text found in PDF, even after AI fallback.', 400)

    const { text } = await notesFor(documents, paperText.slice(0, 250), 5)
    const rawMarkdown = await solveQuestionPaper(paperText, text, subjectName)
    return { solutions: { raw_markdown: rawMarkdown }, documents: brief(documents) }
  }, 'Paper solving failed'),
}
