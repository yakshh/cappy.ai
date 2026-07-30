import { useState, useEffect } from 'react'
import { quizService, documentService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import CategoryDocumentSelector from '../components/CategoryDocumentSelector'
import { Zap, RotateCcw, Download, ChevronLeft, ChevronRight, HelpCircle, CreditCard, Sparkles, CheckCircle, XCircle, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'

const QUIZ_TYPES = [
  { id: 'mcq',        label: 'MCQ',        icon: Zap        },
  { id: 'flashcards', label: 'Flashcards', icon: CreditCard },
]

export default function QuizPage() {
  const [documents, setDocuments] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [quizType, setQuizType] = useState('mcq')
  const [numQuestions, setNumQuestions] = useState(5)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [score, setScore] = useState(null)
  
  // Flashcards state
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    documentService.list()
      .then(({ data }) => setDocuments(data.filter((d) => d.status === 'ready')))
      .finally(() => setLoadingDocs(false))
  }, [])

  const toggleDoc = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id])

  const handleGenerate = async () => {
    if (!selectedIds.length) { toast.error('Select at least one document.'); return }
    setLoading(true); setQuestions([]); setAnswers({}); setScore(null); setCurrentIndex(0); setFlipped(false)
    try {
      const { data } = await quizService.generate({
        document_ids: selectedIds, quiz_type: quizType,
        num_questions: numQuestions,
      })
      setQuestions(data.questions)
      toast.success(`${data.num_questions} ${quizType === 'flashcards' ? 'flashcards' : 'questions'} generated!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswer = (idx, val) => {
    const newAnswers = { ...answers, [idx]: val }
    setAnswers(newAnswers)
    if (Object.keys(newAnswers).length === questions.length && quizType === 'mcq') {
      const correct = questions.filter((q, i) => newAnswers[i] === q.answer).length
      setScore({ correct, total: questions.length })
    }
  }

  const handleReset = () => { setAnswers({}); setScore(null) }

  const handleDownload = () => {
    const text = questions.map((q, i) => {
      if (quizType === 'flashcards') {
        return `Card ${i + 1}:\nQ: ${q.front || q.question}\nA: ${q.back || q.answer}\n`
      }
      const opts = Object.entries(q.options || {}).map(([k, v]) => `  ${k}. ${v}`).join('\n')
      return `Q${i + 1}: ${q.question}\n${opts}\nAnswer: ${q.answer}\n`
    }).join('\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${quizType}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported as .txt file!')
  }

  const prev = () => { setCurrentIndex((i) => Math.max(0, i - 1)); setFlipped(false) }
  const next = () => { setCurrentIndex((i) => Math.min(questions.length - 1, i + 1)); setFlipped(false) }

  return (
    <div className="anim-in" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, height: 'calc(100vh - 128px)' }}>

      {/* ── Left Config Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', height: '100%' }}>

        {/* Mode Selector */}
        <div className="card" style={{ padding: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
            Type
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {QUIZ_TYPES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setQuizType(id); setQuestions([]); setScore(null) }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '10px 4px', borderRadius: 7, cursor: 'pointer', border: '1px solid',
                  borderColor: quizType === id ? 'var(--accent)' : 'var(--border)',
                  background: quizType === id ? 'var(--accent-dim)' : 'var(--surface2)',
                  color: quizType === id ? 'var(--accent)' : 'var(--text2)',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={16} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Count Slider */}
        <div className="card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>
              {quizType === 'flashcards' ? 'Cards' : 'Questions'}
            </span>
            <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{numQuestions}</span>
          </div>
          <input
            type="range"
            min={5}
            max={30}
            step={5}
            value={numQuestions}
            onChange={(e) => setNumQuestions(+e.target.value)}
            style={{
              width: '100%',
              cursor: 'pointer',
              background: `linear-gradient(to right, var(--accent) ${((numQuestions - 5) / 25) * 100}%, var(--surface2) ${((numQuestions - 5) / 25) * 100}%)`
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginTop: 6, padding: '0 2px' }}>
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNumQuestions(n)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: numQuestions === n ? 'var(--accent)' : 'var(--text3)',
                  fontWeight: numQuestions === n ? 700 : 400,
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Document Selector — Stretched Vertically to fill empty space */}
        <div className="card" style={{ padding: 14, flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
            Context Documents
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {loadingDocs ? (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <LoadingSpinner size="sm" text="Loading..." />
              </div>
            ) : (
              <CategoryDocumentSelector
                documents={documents}
                selectedIds={selectedIds}
                onToggleDoc={toggleDoc}
                onSelectAll={(ids) => setSelectedIds(ids)}
              />
            )}
          </div>
        </div>

        {/* Generate Button — Fixed at Bottom */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', flexShrink: 0 }}
          onClick={handleGenerate}
          disabled={loading || selectedIds.length === 0}
        >
          {loading ? (
            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Generating...</>
          ) : (
            <><Sparkles size={14} /> Generate {quizType === 'mcq' ? 'Quiz' : 'Cards'}</>
          )}
        </button>

      </div>

      {/* ── Right Play Area ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top Action Bar when questions ready */}
        {questions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot dot-green" />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {quizType === 'mcq' ? `${questions.length} MCQs` : `${questions.length} Flashcards`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {quizType === 'mcq' && (
                <button className="btn btn-ghost btn-sm" onClick={handleReset}>
                  <RotateCcw size={12} /> Reset Answers
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleDownload}>
                <Download size={12} /> Export Text
              </button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Idle State */}
          {!loading && questions.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center' }}>
              {quizType === 'mcq' ? <Zap size={30} style={{ color: 'var(--text3)' }} /> : <CreditCard size={30} style={{ color: 'var(--text3)' }} />}
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {quizType === 'mcq' ? 'Practice Quiz Ready' : 'Flashcard Studio Ready'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 280 }}>
                Select documents on the left and click Generate to start.
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <LoadingSpinner size="sm" text={`Generating ${numQuestions} ${quizType}...`} />
              </div>
              {[80, 95, 60, 85, 40].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 20, width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* MCQ Session */}
          {!loading && questions.length > 0 && quizType === 'mcq' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680, margin: '0 auto' }}>
              {/* Score Banner */}
              {score && (
                <div className="card anim-in" style={{ padding: 16, background: 'var(--accent-dim)', borderColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Trophy size={20} style={{ color: 'var(--accent)' }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Quiz Completed!</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>You scored {score.correct} out of {score.total} ({Math.round((score.correct / score.total) * 100)}%)</div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleReset}>
                    <RotateCcw size={12} /> Retake
                  </button>
                </div>
              )}

              {questions.map((q, idx) => {
                const userAns = answers[idx]
                const isAnswered = userAns !== undefined
                const isCorrect = userAns === q.answer

                return (
                  <div key={idx} className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                      <span className="tag tag-accent" style={{ height: 'fit-content', flexShrink: 0 }}>Q{idx + 1}</span>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{q.question}</p>
                    </div>

                    {/* Options */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginBottom: 12 }}>
                      {Object.entries(q.options || {}).map(([key, text]) => {
                        let state = ''
                        if (isAnswered) {
                          if (key === q.answer) state = 'correct'
                          else if (key === userAns) state = 'wrong'
                        } else if (userAns === key) {
                          state = 'selected'
                        }

                        return (
                          <div
                            key={key}
                            className={`mcq-option ${state}`}
                            onClick={() => !score && handleAnswer(idx, key)}
                          >
                            <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, width: 20, flexShrink: 0 }}>{key}.</span>
                            <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{text}</span>
                            {isAnswered && key === q.answer && <CheckCircle size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />}
                            {isAnswered && key === userAns && key !== q.answer && <XCircle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation */}
                    {isAnswered && q.explanation && (
                      <div style={{ padding: '10px 14px', borderRadius: 7, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                        <strong style={{ color: 'var(--text)' }}>Explanation: </strong>{q.explanation}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Flashcard Session */}
          {!loading && questions.length > 0 && quizType === 'flashcards' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, maxWidth: 520, margin: '0 auto' }}>
              
              {/* Card Indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
                <span>Card {currentIndex + 1} of {questions.length}</span>
                <span>·</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Click card to flip</span>
              </div>

              {/* 3D Flip Card */}
              <div
                className="flashcard-container"
                style={{ width: '100%', height: 260, cursor: 'pointer' }}
                onClick={() => setFlipped(!flipped)}
              >
                <div className={`flashcard ${flipped ? 'flipped' : ''}`} style={{ width: '100%', height: '100%' }}>
                  {/* Front */}
                  <div className="flashcard-face card" style={{ position: 'absolute', inset: 0, padding: 28, display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', alignItems: 'center', textAlign: 'center', background: 'var(--surface)' }}>
                    <span className="tag tag-accent" style={{ fontSize: 10 }}>QUESTION / TERM</span>
                    <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 'auto 0', lineHeight: 1.5 }}>
                      {questions[currentIndex]?.front || questions[currentIndex]?.question}
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Click to reveal answer ↺</span>
                  </div>

                  {/* Back */}
                  <div className="flashcard-face flashcard-back card" style={{ position: 'absolute', inset: 0, padding: 28, display: 'flex', flexDirection: 'column', justifyBetween: 'space-between', alignItems: 'center', textAlign: 'center', background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
                    <span className="tag tag-green" style={{ fontSize: 10 }}>ANSWER / DEFINITION</span>
                    <p style={{ fontSize: 15, color: 'var(--text)', margin: 'auto 0', lineHeight: 1.5 }}>
                      {questions[currentIndex]?.back || questions[currentIndex]?.answer}
                    </p>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Click to see question ↺</span>
                  </div>
                </div>
              </div>

              {/* Flashcard Navigation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button className="btn btn-ghost" onClick={prev} disabled={currentIndex === 0}>
                  <ChevronLeft size={14} /> Previous
                </button>
                <button className="btn btn-primary" onClick={next} disabled={currentIndex === questions.length - 1}>
                  Next <ChevronRight size={14} />
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  )
}
