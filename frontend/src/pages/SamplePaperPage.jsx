import { useState, useEffect } from 'react'
import { samplePaperService, documentService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import CategoryDocumentSelector from '../components/CategoryDocumentSelector'
import { FileSpreadsheet, FileText, Download, Printer, Sparkles, Upload, BookOpen, Building, Hash, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function SamplePaperPage() {
  const [documents, setDocuments] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [mode, setMode] = useState('generate') // generate | solve
  
  // Generate mode state
  const [universityName, setUniversityName] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [examTerm, setExamTerm] = useState('')

  // Solve mode state
  const [solvePaperText, setSolvePaperText] = useState('')
  const [solveSubjectName, setSolveSubjectName] = useState('')

  const [loading, setLoading] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [paperData, setPaperData] = useState(null)
  const [solutionData, setSolutionData] = useState(null)

  useEffect(() => {
    documentService.list()
      .then(({ data }) => {
        const ready = data.filter((d) => d.status === 'ready')
        setDocuments(ready)
        if (ready.length > 0) setSelectedIds([ready[0].id])
      })
      .finally(() => setLoadingDocs(false))
  }, [])

  const toggleDoc = (id) => setSelectedIds((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id])

  const handleGenerate = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one study document.')
      return
    }
    setLoading(true)
    setPaperData(null)

    try {
      const { data } = await samplePaperService.generate({
        document_ids: selectedIds,
        university_name: universityName.trim() || undefined,
        subject_code: subjectCode.trim() || '3160716',
        subject_name: subjectName.trim() || 'IOT and Applications',
        exam_term: examTerm.trim() || 'SUMMER 2024',
        total_marks: 70,
      })
      setPaperData(data.paper)
      toast.success('Sample Paper generated successfully!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Sample Paper generation failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleSolve = async () => {
    if (!selectedIds.length) {
      toast.error('Select at least one study document.')
      return
    }
    if (!solvePaperText.trim()) {
      toast.error('Paste or upload question paper text to solve.')
      return
    }
    setLoading(true)
    setSolutionData(null)

    try {
      const { data } = await samplePaperService.solve({
        document_ids: selectedIds,
        paper_text: solvePaperText.trim(),
        subject_name: solveSubjectName.trim() || 'Subject Exam',
      })
      setSolutionData(data.solutions)
      toast.success('Question Paper solutions generated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Paper solving failed.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      setSolvePaperText(evt.target?.result || '')
      toast.success(`Loaded question paper text from "${file.name}"`)
    }
    reader.readAsText(file)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = () => {
    const element = document.getElementById(mode === 'solve' ? 'printable-solution-paper' : 'printable-sample-paper')
    if (!element) return

    toast.loading('Generating PDF document...', { id: 'pdf-toast' })

    const opt = {
      margin: [10, 10, 10, 10],
      filename: mode === 'solve' ? 'Question_Paper_Solutions.pdf' : `Sample_Paper_${paperData?.subject_code || 'Exam'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }

    import('html2pdf.js')
      .then((html2pdfModule) => {
        const html2pdf = html2pdfModule.default || html2pdfModule
        html2pdf()
          .set(opt)
          .from(element)
          .save()
          .then(() => {
            toast.success('PDF downloaded!', { id: 'pdf-toast' })
          })
          .catch(() => {
            toast.error('PDF generation failed.', { id: 'pdf-toast' })
          })
      })
      .catch(() => {
        toast.error('Could not load PDF module.', { id: 'pdf-toast' })
      })
  }

  return (
    <div className="anim-in responsive-workspace" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, height: 'calc(100vh - 128px)' }}>

      {/* ── Left Config Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', gap: 3 }}>
          {[{ v: 'generate', icon: FileSpreadsheet, label: 'Generate' }, { v: 'solve', icon: BookOpen, label: 'Solve Paper' }].map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => { setMode(v); setPaperData(null); setSolutionData(null) }}
              className={mode === v ? 'btn btn-primary' : 'btn btn-ghost'}
              style={{ flex: 1, justifyContent: 'center', padding: '7px', border: 'none' }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Mode Form Fields */}
        {mode === 'generate' ? (
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h3 className="font-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Paper Header Details</h3>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                <Building size={11} /> University Name
              </label>
              <input className="input" placeholder="e.g. GTU University" value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                  <Hash size={11} /> Code
                </label>
                <input className="input" placeholder="3160716" value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                  <Calendar size={11} /> Term
                </label>
                <input className="input" placeholder="SUMMER 2024" value={examTerm} onChange={(e) => setExamTerm(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Subject Name</label>
              <input className="input" placeholder="e.g. Internet of Things" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="font-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Question Paper Input</h3>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', gap: 4 }}>
                <Upload size={11} /> Upload File
                <input type="file" accept=".txt,.md" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Subject Name</label>
              <input className="input" placeholder="e.g. Internet of Things" value={solveSubjectName} onChange={(e) => setSolveSubjectName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Paste Questions Text</label>
              <textarea className="input" style={{ resize: 'vertical', minHeight: 90 }} placeholder="Q.1 Explain MQTT architecture (7 marks)..." value={solvePaperText} onChange={(e) => setSolvePaperText(e.target.value)} />
            </div>
          </div>
        )}

        {/* Document Selector */}
        <div className="card" style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
            Context RAG Docs
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingDocs ? (
              <div style={{ padding: '16px 0', textAlign: 'center' }}>
                <LoadingSpinner size="sm" text="Loading documents..." />
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

        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px' }}
          onClick={mode === 'generate' ? handleGenerate : handleSolve}
          disabled={loading || selectedIds.length === 0}
        >
          {loading ? (
            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Processing...</>
          ) : mode === 'generate' ? (
            <><Sparkles size={14} /> Generate Sample Paper</>
          ) : (
            <><BookOpen size={14} /> Solve Question Paper</>
          )}
        </button>

      </div>

      {/* ── Right Output View ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Output Header */}
        {(paperData || solutionData) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              <span className="dot dot-green" style={{ marginRight: 6 }} />
              {mode === 'generate' ? 'Exam paper ready' : 'Solutions ready'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={handlePrint}><Printer size={12} /> Print</button>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadPdf}><Download size={12} /> Download PDF</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {/* Empty state */}
          {!paperData && !solutionData && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center' }}>
              <FileSpreadsheet size={30} style={{ color: 'var(--text3)' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {mode === 'generate' ? 'Generate 70-Mark Question Paper' : 'Solve Existing Exam Paper'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 300 }}>
                {mode === 'generate'
                  ? 'Creates a university format exam paper grounded in your uploaded study notes.'
                  : 'AI generates detailed step-by-step answers for your question paper text.'}
              </p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <LoadingSpinner size="sm" text={mode === 'generate' ? 'Synthesizing exam paper from docs...' : 'Solving questions using RAG context...'} />
              </div>
              {[85, 60, 95, 45, 75, 90, 50].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 16, width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Printable Generated Paper View */}
          {!loading && paperData && mode === 'generate' && (
            <div id="printable-sample-paper" className="prose-dark anim-in" style={{ padding: 12, background: 'var(--surface)', color: 'var(--text)' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid var(--border)', paddingBottom: 12, marginBottom: 16 }}>
                <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {paperData.university_name || 'GUJARAT TECHNOLOGICAL UNIVERSITY'}
                </h2>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginTop: 4 }}>
                  {paperData.subject_name || 'Subject Exam'} ({paperData.subject_code || 'CODE'})
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
                  <span>Term: {paperData.exam_term || 'SUMMER 2024'}</span>
                  <span>Total Marks: {paperData.total_marks || 70}</span>
                </div>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{paperData.raw_markdown || paperData.content}</ReactMarkdown>
            </div>
          )}

          {/* Printable Solutions View */}
          {!loading && solutionData && mode === 'solve' && (
            <div id="printable-solution-paper" className="prose-dark anim-in" style={{ padding: 12, background: 'var(--surface)', color: 'var(--text)' }}>
              <div style={{ borderBottom: '2px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
                <span className="tag tag-accent" style={{ fontSize: 10, marginBottom: 4 }}>Model Solutions</span>
                <h2 className="font-display" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                  Solutions for {solveSubjectName || 'Exam Paper'}
                </h2>
              </div>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof solutionData === 'string' ? solutionData : solutionData.raw_markdown}</ReactMarkdown>
            </div>
          )}
        </div>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
