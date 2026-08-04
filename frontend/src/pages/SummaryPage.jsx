import { useState, useEffect } from 'react'
import { summaryService, documentService } from '../services'
import MarkdownRenderer from '../components/MarkdownRenderer'
import LoadingSpinner from '../components/LoadingSpinner'
import CategoryDocumentSelector from '../components/CategoryDocumentSelector'
import {
  FileText, BookOpen, List, AlignLeft, Download,
  Sparkles, Copy, Check, Target, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

const MODES = [
  { id: 'short',    icon: AlignLeft, label: 'Overview',  desc: 'Concise summary' },
  { id: 'detailed', icon: BookOpen,  label: 'Detailed',  desc: 'In-depth notes' },
  { id: 'bullets',  icon: List,      label: 'Bullets',   desc: 'Key highlights' },
]

export default function SummaryPage() {
  const [documents, setDocuments] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [mode, setMode] = useState('short')
  const [topic, setTopic] = useState('')
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [meta, setMeta] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    documentService.list()
      .then(({ data }) => {
        const ready = data.filter((d) => d.status === 'ready')
        setDocuments(ready)
        if (ready.length > 0) setSelectedIds([ready[0].id])
      })
      .catch(console.error)
      .finally(() => setLoadingDocs(false))
  }, [])

  const toggleDoc = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])
  }

  const handleGenerate = async () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one study document.')
      return
    }
    setLoading(true)
    setSummary('')
    try {
      const { data } = await summaryService.generate({
        document_ids: selectedIds,
        mode,
        topic: topic.trim() || undefined,
      })
      setSummary(data.summary)
      setMeta(data)
      toast.success('Summary generated!')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Generation failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!summary) return
    navigator.clipboard.writeText(summary)
    setCopied(true)
    toast.success('Summary copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadPDF = async () => {
    if (!summary) return
    const contentEl = document.getElementById('summary-content-body')
    if (!contentEl) return

    toast.loading('Converting summary to PDF...', { id: 'pdf-summary' })

    // Create a temporary off-screen element for clean PDF rendering
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = '-9999px'
    tempDiv.style.top = '-9999px'
    tempDiv.style.width = '750px'
    tempDiv.style.background = '#ffffff'
    tempDiv.style.color = '#111827'
    tempDiv.style.padding = '30px 36px'
    tempDiv.style.fontFamily = 'Inter, system-ui, sans-serif'

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    tempDiv.innerHTML = `
      <div style="border-bottom: 2px solid #C9514A; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">
            cappy<span style="color:#C9514A;">.ai</span> — Study Summary
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-top: 3px;">
            Mode: <strong style="color:#111827;">${mode.toUpperCase()}</strong> ${topic ? `| Topic: ${topic}` : ''}
          </div>
        </div>
        <div style="font-size: 11px; color: #9CA3AF; text-align: right;">
          ${dateStr}
        </div>
      </div>
      <div class="pdf-markdown-body" style="font-size: 13.5px; line-height: 1.65; color: #1F2937;">
        ${contentEl.innerHTML}
      </div>
      <style>
        .pdf-markdown-body h1, .pdf-markdown-body h2, .pdf-markdown-body h3 { color: #111827 !important; font-weight: 700 !important; margin-top: 16px !important; margin-bottom: 8px !important; }
        .pdf-markdown-body p { margin-bottom: 10px !important; color: #1F2937 !important; }
        .pdf-markdown-body ul { list-style-type: disc !important; padding-left: 20px !important; margin-bottom: 10px !important; }
        .pdf-markdown-body ol { list-style-type: decimal !important; padding-left: 20px !important; margin-bottom: 10px !important; }
        .pdf-markdown-body li { margin-bottom: 4px !important; color: #1F2937 !important; }
        .pdf-markdown-body strong { color: #111827 !important; font-weight: 700 !important; }
        .pdf-markdown-body code { background: #F3F4F6 !important; color: #C9514A !important; padding: 2px 5px !important; border-radius: 4px !important; }
        .pdf-markdown-body pre { background: #F3F4F6 !important; padding: 10px !important; border-radius: 6px !important; overflow-x: auto !important; }
        .pdf-markdown-body blockquote { border-left: 3px solid #C9514A !important; padding-left: 10px !important; color: #4B5563 !important; font-style: italic !important; }
      </style>
    `

    document.body.appendChild(tempDiv)

    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule.default || html2pdfModule
      const opt = {
        margin: [10, 10, 10, 10],
        filename: `cappy_summary_${mode}_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }
      await html2pdf().set(opt).from(tempDiv).save()
      toast.success('PDF downloaded successfully!', { id: 'pdf-summary' })
    } catch (err) {
      console.error(err)
      toast.error('PDF export failed. Try again.', { id: 'pdf-summary' })
    } finally {
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv)
      }
    }
  }

  return (
    <div className="anim-in responsive-workspace" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, height: 'calc(100vh - 128px)' }}>

      {/* ── Left Config Panel ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>

        {/* Documents Selector */}
        <div className="card" style={{ padding: 16, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 className="font-display" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Select Context Docs</h3>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{selectedIds.length} selected</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingDocs ? (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
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

        {/* Summary Mode Selector */}
        <div className="card" style={{ padding: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 8 }}>
            Summary Style
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {MODES.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '8px 4px', borderRadius: 7, cursor: 'pointer', border: '1px solid',
                  borderColor: mode === id ? 'var(--accent)' : 'var(--border)',
                  background: mode === id ? 'var(--accent-dim)' : 'var(--surface2)',
                  color: mode === id ? 'var(--accent)' : 'var(--text2)',
                  transition: 'all 0.15s'
                }}
              >
                <Icon size={14} />
                <span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Focus Topic Input */}
        <div className="card" style={{ padding: 14 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
            <Target size={11} /> Focus Topic (Optional)
          </label>
          <input
            className="input"
            placeholder="e.g. MQTT vs CoAP, Neural Networks..."
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        {/* Submit button */}
        <button
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '11px 16px' }}
          onClick={handleGenerate}
          disabled={loading || selectedIds.length === 0}
        >
          {loading ? (
            <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Summarizing...</>
          ) : (
            <><Sparkles size={14} /> Generate Summary</>
          )}
        </button>
      </div>

      {/* ── Right Markdown Output Panel ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        {summary && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot dot-green" />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Summary generated</span>
              {meta?.chunk_count && <span className="tag tag-neutral" style={{ fontSize: 10 }}>{meta.chunk_count} chunks</span>}
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
                {copied ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={handleDownloadPDF}>
                <Download size={12} /> Download PDF
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!summary && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, textAlign: 'center' }}>
              <BookOpen size={30} style={{ color: 'var(--text3)' }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No summary generated yet</p>
              <p style={{ fontSize: 13, color: 'var(--text2)', maxWidth: 280 }}>Select documents on the left and click Generate Summary.</p>
            </div>
          )}

          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <LoadingSpinner size="sm" text="Synthesizing concepts from documents..." />
              </div>
              {[80, 95, 60, 85, 40, 75, 90, 50, 70, 35].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 13, width: `${w}%` }} />
              ))}
            </div>
          )}

          {summary && !loading && (
            <div id="summary-content-body" className="prose-dark anim-in">
              <MarkdownRenderer content={summary} />
            </div>
          )}
        </div>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
