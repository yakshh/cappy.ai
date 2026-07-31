import { useState, useEffect } from 'react'
import { samplePaperService, documentService } from '../services'
import LoadingSpinner from '../components/LoadingSpinner'
import CategoryDocumentSelector from '../components/CategoryDocumentSelector'
import { FileSpreadsheet, Download, Printer, Sparkles, Upload, BookOpen, Building, Hash, Calendar } from 'lucide-react'
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
  const [solvePaperFile, setSolvePaperFile] = useState(null)
  const [solveUniversityName, setSolveUniversityName] = useState('')
  const [solveSubjectCode, setSolveSubjectCode] = useState('')
  const [solveSubjectName, setSolveSubjectName] = useState('')
  const [solveExamTerm, setSolveExamTerm] = useState('')

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
    if (!universityName.trim() || !subjectCode.trim() || !subjectName.trim() || !examTerm.trim()) {
      toast.error('Please fill in all Paper Header Details.')
      return
    }
    setLoading(true)
    setPaperData(null)

    try {
      const { data } = await samplePaperService.generate({
        document_ids: selectedIds,
        university_name: universityName.trim(),
        subject_code: subjectCode.trim(),
        subject_name: subjectName.trim(),
        exam_term: examTerm.trim(),
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
    if (!solvePaperFile) {
      toast.error('Please upload a PDF question paper to solve.')
      return
    }
    if (!solveSubjectCode.trim() || !solveSubjectName.trim()) {
      toast.error('Please fill in both Subject Code and Subject Name.')
      return
    }
    setLoading(true)
    setSolutionData(null)

    const formData = new FormData()
    formData.append('file', solvePaperFile)
    selectedIds.forEach((id) => formData.append('document_ids', id))
    formData.append('subject_name', solveSubjectName.trim())

    try {
      const { data } = await samplePaperService.solveUpload(formData)
      // The backend returns { raw_markdown: "...json string..." }
      // Parse and convert to readable markdown
      let solutions = data.solutions
      let rawContent = typeof solutions === 'string' ? solutions : solutions?.raw_markdown || solutions
      
      // Try to parse as JSON and convert to markdown
      try {
        let parsed = typeof rawContent === 'string' ? JSON.parse(rawContent) : rawContent
        // Handle nested: { solutions: { solutions: [...] } } or { solutions: [...] }
        if (parsed?.solutions?.solutions) parsed = parsed.solutions
        if (parsed?.solutions) parsed = parsed
        
        const solutionItems = parsed?.solutions || (Array.isArray(parsed) ? parsed : null)
        if (solutionItems && Array.isArray(solutionItems)) {
          let md = `# Solutions — ${parsed.subject_name || solveSubjectName}\n\n`
          for (const q of solutionItems) {
            md += `## ${q.q_no}\n\n`
            for (const item of (q.solution_items || [])) {
              md += `### Part ${item.part} *(${item.marks} marks)*\n\n`
              if (item.question) md += `**Question:** ${item.question}\n\n`
              md += `**Answer:** ${item.answer}\n\n---\n\n`
            }
          }
          setSolutionData({ raw_markdown: md })
        } else {
          setSolutionData({ raw_markdown: typeof rawContent === 'string' ? rawContent : JSON.stringify(parsed, null, 2) })
        }
      } catch {
        setSolutionData({ raw_markdown: typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2) })
      }
      
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
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a valid PDF file.')
      return
    }
    setSolvePaperFile(file)
    toast.success(`Selected "${file.name}"`)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = () => {
    const element = document.getElementById(mode === 'solve' ? 'printable-solution-paper' : 'printable-sample-paper')
    if (!element) return

    toast.loading('Generating PDF document...', { id: 'pdf-toast' })

    const sCode = (mode === 'solve' ? solveSubjectCode : subjectCode).trim().replace(/\s+/g, '_') || 'CODE'
    const sName = (mode === 'solve' ? solveSubjectName : subjectName).trim().replace(/\s+/g, '_') || 'Subject'
    const fName = mode === 'solve' 
      ? `Solved_Paper_${sCode}_${sName}.pdf` 
      : `Sample_Paper_${sCode}_${sName}_ID-${paperData?.paper_id || 'manual'}.pdf`

    const opt = {
      margin: [10, 10, 10, 10],
      filename: fName,
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
              <h3 className="font-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Upload Question Paper</h3>
              <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', gap: 4 }}>
                <Upload size={11} /> Browse PDF
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <div style={{ background: 'var(--surface2)', border: '1px dashed var(--border)', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 6 }}>
              {solvePaperFile ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{solvePaperFile.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Ready to solve</div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>No PDF uploaded yet.</div>
              )}
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 5 }}>
                <Hash size={11} /> Code
              </label>
              <input className="input" placeholder="3160716" value={solveSubjectCode} onChange={(e) => setSolveSubjectCode(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', display: 'block', marginBottom: 5 }}>Subject Name</label>
              <input className="input" placeholder="e.g. Internet of Things" value={solveSubjectName} onChange={(e) => setSolveSubjectName(e.target.value)} />
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

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: (paperData || solutionData) ? '#ffffff' : 'transparent' }}>
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
            <div id="printable-sample-paper" className="anim-in" style={{ padding: '20px 40px', color: '#000000', backgroundColor: '#ffffff', fontFamily: 'serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: 12, marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                  {universityName}
                </h2>
                <p style={{ fontSize: 16, fontWeight: 600, marginTop: 6, marginBottom: 10 }}>
                  {subjectName} ({subjectCode})
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
                  <span>Term: {examTerm}</span>
                  <span>Total Marks: 70</span>
                </div>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6 }} className="markdown-pdf-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{paperData.raw_markdown || paperData.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Printable Solutions View */}
          {!loading && solutionData && mode === 'solve' && (
            <div id="printable-solution-paper" className="anim-in" style={{ padding: '20px 40px', color: '#000000', backgroundColor: '#ffffff', fontFamily: 'serif' }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000000', paddingBottom: 12, marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, textTransform: 'uppercase' }}>
                  Solutions for {solveSubjectName} ({solveSubjectCode})
                </h2>
                <p style={{ fontSize: 14, marginTop: 6, fontStyle: 'italic' }}>AI-Generated Model Answers</p>
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.6 }} className="markdown-pdf-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{typeof solutionData === 'string' ? solutionData : solutionData.raw_markdown}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}
      .markdown-pdf-body h1, .markdown-pdf-body h2, .markdown-pdf-body h3 { font-family: serif; color: #000; margin-top: 1.5em; margin-bottom: 0.5em; }
      .markdown-pdf-body p { margin-bottom: 1em; }
      .markdown-pdf-body strong { font-weight: 700; }
      `}</style>
    </div>
  )
}
