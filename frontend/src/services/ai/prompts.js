import { generateText, generateJson, parseJsonRobust } from './gemini'
import { apiError } from '../errors'

const seed = () => Math.floor(1000 + Math.random() * 999000)

export function buildContext(chunks) {
  return chunks
    .map((c, i) => `[Source ${i + 1}] Document: '${c.document_name}' | Page ${c.page}\n${c.text}`)
    .join('\n\n---\n\n')
}

export async function generateAnswer(question, chunks) {
  if (!chunks.length) {
    return { answer: "I couldn't find this information in your uploaded documents.", sources: [] }
  }

  const prompt = `You are cappy.ai, an AI learning assistant. Your ONLY job is to answer questions using the provided document excerpts below.

STRICT RULES:
1. Answer ONLY based on the provided context. Do NOT use any outside knowledge.
2. If the answer is not in the context, respond exactly: "I couldn't find this information in your uploaded documents."
3. Always cite your sources using [Source N] notation.
4. Be clear, concise, and helpful for a student audience.
5. Format your answer in clean Markdown.

CONTEXT FROM UPLOADED DOCUMENTS:
${buildContext(chunks)}

---

Question: ${question}

Answer:`

  const answer = await generateText(prompt)

  const seen = new Set()
  const sources = []
  for (const c of chunks) {
    const key = `${c.document_id}:${c.page}`
    if (seen.has(key)) continue
    seen.add(key)
    sources.push({
      document_id: c.document_id,
      document_name: c.document_name,
      page: c.page,
      score: c.score ?? 0,
    })
  }
  return { answer, sources }
}

const SUMMARY_MODES = {
  short: 'Write a thorough, well-structured summary of approximately 350 to 550 words covering all essential core concepts, background, and main findings.',
  detailed: 'Write an extensive, highly detailed, in-depth academic summary of approximately 800 to 1200 words. Explain all definitions, core principles, sub-topics, algorithms/protocols, real-world examples, and conclusions in complete technical detail.',
  bullets: 'Write an exhaustive, highly structured bullet-point summary breakdown (700 to 1000 words) with clear section headers, bold terminology, sub-bullet explanations, and detailed key takeaways.',
}

export function generateSummary(text, mode = 'short', topic = '') {
  let instruction = SUMMARY_MODES[mode] || SUMMARY_MODES.short
  if (topic?.trim()) {
    instruction += ` Specifically focus on and emphasize all concepts, principles, and instances related to '${topic.trim()}'.`
  }
  return generateText(`You are an expert academic summarizer. ${instruction}

Only use information from the provided text. Do NOT add external knowledge. Provide a comprehensive, full-length response.

TEXT:
${text.slice(0, 12000)}

SUMMARY:`)
}

function toList(raw, errorMessage) {
  try {
    const parsed = parseJsonRobust(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch (err) {
    console.warn('[AI JSON]', err.message, String(raw).slice(0, 200))
    throw apiError(errorMessage, 500)
  }
}

export async function generateQuiz(text, numQuestions = 5) {
  const prompt = `You are an expert educator creating exam questions. Generate ${numQuestions} multiple-choice questions (MCQ) with 4 options (A, B, C, D) and mark the correct answer. Format as JSON array. (Variation Seed #${seed()}: Generate fresh, unique questions covering different concepts and subtopics than previous runs).

Return a valid JSON object with a root key "questions" containing an array of ${numQuestions} questions.

JSON FORMAT:
{"questions": [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "explanation": "..."}]}

TEXT:
${text.slice(0, 3500)}

JSON OUTPUT:`
  return toList(await generateJson(prompt), 'AI returned invalid format. Please try again.')
}

export async function generateFlashcards(text, numCards = 10) {
  const prompt = `You are a study assistant creating flashcards. Generate ${numCards} unique flashcards from the text below.
VARIATION SEED #${seed()}: Focus on different terms, definitions, and key facts than previous runs.

Return a valid JSON object with a root key "flashcards" containing an array of ${numCards} flashcards:
{"flashcards": [{"front": "Question or term", "back": "Answer or definition", "category": "topic name"}]}

Use ONLY information from the provided text.

TEXT:
${text.slice(0, 3500)}

JSON OUTPUT:`
  return toList(await generateJson(prompt), 'AI returned invalid flashcard format. Please try again.')
}

// Every exam question has parts (a) 3, (b) 4, (c) 7 marks.
// Q.1 has no OR, Q.2 has an OR for (c) only, Q.3-Q.5 have a full OR set.
const PARTS = [['(a)', 3], ['(b)', 4], ['(c)', 7]]
const partJson = ([p, marks]) => `{"part": "${p}", "question": "...", "marks": ${marks}}`
const itemsJson = (list) => `[${list.map(partJson).join(', ')}]`

export async function generateSamplePaper(text, { universityName, subjectCode, subjectName, examTerm, totalMarks }) {
  const questionsSchema = [1, 2, 3, 4, 5]
    .map((n) => {
      const orItems = n === 1 ? '[]' : n === 2 ? itemsJson([PARTS[2]]) : itemsJson(PARTS)
      return `    {"q_no": "Q.${n}", "items": ${itemsJson(PARTS)}, "or_items": ${orItems}}`
    })
    .join(',\n')

  const prompt = `You are an expert university examiner.
Generate a fresh, unique, and realistic sample examination question paper based strictly on the provided study notes.
VARIATION SEED #${seed()}: Focus on different topics, subtopics, and phrasing than previous papers.

PAPER METADATA:
University Name: ${universityName}
Subject Code: ${subjectCode}
Subject Name: ${subjectName}
Exam Term: ${examTerm}
Total Marks: ${totalMarks}

QUESTION & MARKING STRUCTURE:
- Q.1: (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]. No OR option.
- Q.2: (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]. OR choice ONLY for sub-question (c) [7 Marks].
- Q.3, Q.4, Q.5: (a) [3 Marks], (b) [4 Marks], (c) [7 Marks]. Each has a full OR question choice with (a) [3 Marks], (b) [4 Marks], (c) [7 Marks].

Return ONLY valid JSON matching this schema:
{
  "university": "${universityName}",
  "examination": "SEMESTER EXAMINATION - ${examTerm}",
  "subject_code": "${subjectCode}",
  "subject_name": "${subjectName}",
  "total_marks": ${totalMarks},
  "time_allowed": "02:30 Hours",
  "instructions": [
    "Attempt all questions.",
    "Make suitable assumptions wherever necessary.",
    "Figures to the right indicate full marks.",
    "Simple and non-programmable scientific calculators are allowed."
  ],
  "questions": [
${questionsSchema}
  ]
}

TEXT FROM STUDY NOTES:
${text.slice(0, 2200)}

JSON OUTPUT:`

  const raw = await generateJson(prompt)
  let paper
  try {
    paper = parseJsonRobust(raw)
  } catch (err) {
    console.warn('[AI JSON]', err.message, raw.slice(0, 200))
    throw apiError('AI returned invalid sample paper format. Please try again.', 500)
  }
  if (!paper.raw_markdown && Array.isArray(paper.questions)) paper.raw_markdown = paperToMarkdown(paper)
  return paper
}

function paperToMarkdown(paper) {
  const line = (i) => `**${i.part || ''}** ${i.question || ''} *(Marks: ${i.marks ?? ''})*`
  const md = []
  if (paper.instructions) {
    md.push('**Instructions:**', ...paper.instructions.map((i) => `- ${i}`), '\n---')
  }
  for (const q of paper.questions) {
    md.push(`\n### ${q.q_no || ''}`, ...(q.items || []).map(line))
    if (q.or_items?.length) md.push('\n**OR**\n', ...q.or_items.map(line))
  }
  return md.join('\n\n')
}

export function solveQuestionPaper(paperText, context, subjectName = 'Subject') {
  return generateText(`You are a master university professor and exam evaluator for '${subjectName}'.
Your task is to provide complete, thorough, step-by-step solutions for every question in the question paper below.

STRICT INSTRUCTIONS:
1. Answer every question and subquestion clearly and accurately.
2. Base explanations on the study context provided below wherever possible.
3. For numerical or code/diagram questions, provide clear explanations or pseudocode.
4. The length of the answer MUST be strictly according to the marks of the questions. For a 3 or 4 marks question, write a concise answer. For a 7+ marks question, write an extensive and highly detailed answer with deep explanations.
5. Format your entire output in clean, structured Markdown. Use appropriate headings for questions (e.g. ### Q.1 (a)).

STUDY CONTEXT FROM NOTES:
${context.slice(0, 8000)}

QUESTION PAPER TO SOLVE:
${paperText.slice(0, 8000)}

MARKDOWN OUTPUT:`)
}
