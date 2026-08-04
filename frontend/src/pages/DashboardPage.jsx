import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { documentService } from '../services'
import DocumentCard from '../components/DocumentCard'
import FileUpload from '../components/FileUpload'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  FileText, Plus, FileSpreadsheet, Zap, BookOpen, Search, Upload, X, Flame, BarChart2
} from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const [now, setNow] = useState(() => new Date())
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')

  const fetchDocuments = async () => {
    try {
      const { data } = await documentService.list()
      setDocuments(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
    const documentInterval = setInterval(fetchDocuments, 5000)
    const clockInterval = setInterval(() => setNow(new Date()), 60000)
    return () => {
      clearInterval(documentInterval)
      clearInterval(clockInterval)
    }
  }, [])

  const handleUploadSuccess = (newDocs) => {
    setDocuments((prev) => [...newDocs, ...prev])
    setShowUpload(false)
  }

  const handleDelete = (docId) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }
  const readyDocs = documents.filter((d) => d.status === 'ready').length
  const processingDocs = documents.filter((d) => d.status === 'processing').length
  const firstName = user?.full_name?.split(' ')[0] || 'User'
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hour = now.getHours()
  const greeting = hour < 5 ? 'night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night'

  const categories = ['All', ...Array.from(new Set(documents.map((d) => d.category || 'General')))]
  const filteredDocs = selectedCategory === 'All'
    ? documents
    : documents.filter((d) => (d.category || 'General') === selectedCategory)

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero Greeting ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
            {dateStr}
          </p>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, marginBottom: 8 }}>
            Good {greeting}, {firstName}.
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text2)' }}>
            Welcome back to your study workspace · <strong style={{ color: 'var(--text)' }}>{readyDocs} documents</strong> ready for query
          </p>
        </div>

        {/* Right action button */}
        <button
          onClick={() => setShowUpload(!showUpload)}
          id="open-upload-btn"
          className={showUpload ? "btn btn-ghost" : "btn btn-primary"}
          style={{ gap: 6, padding: '10px 16px', border: showUpload ? '1px solid var(--border)' : 'none' }}
        >
          {showUpload ? <X size={15} /> : <Plus size={15} />}
          {showUpload ? 'Close Uploader' : 'Upload PDF'}
        </button>
      </div>

      {/* Upload Dropzone Panel */}
      {showUpload && (
        <div className="card anim-in" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Upload Study Material</h2>
            <button onClick={() => setShowUpload(false)} className="btn-icon" style={{ width: 28, height: 28 }}><X size={14} /></button>
          </div>
          <FileUpload onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text)', lineHeight: 1 }}>{documents.length}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4 }}>Total Documents</div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart2 size={18} style={{ color: 'var(--green)' }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text)', lineHeight: 1 }}>{readyDocs}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4 }}>Ready to Query</div>
          </div>
        </div>

        <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text)', lineHeight: 1 }}>{processingDocs}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 4 }}>Processing</div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <h2 className="font-display" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Quick Actions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            { to: '/sample-paper', icon: FileSpreadsheet, label: 'Exam Papers', desc: '70-Mark University Paper' },
            { to: '/quiz',         icon: Zap,             label: 'Quiz & Flashcards', desc: 'MCQs & 3D Flip Cards' },
            { to: '/summary',      icon: BookOpen,        label: 'Summarize Notes', desc: 'AI Synthesis & Markdown' },
            { to: '/search',       icon: Search,          label: 'Deep Vector Search', desc: 'Semantic Search by Meaning' },
          ].map(({ to, icon: Icon, label, desc }) => (
            <Link key={label} to={to} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Documents Section ── */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h2 className="font-display" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Your Indexed Documents</h2>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Organize your study notes by subject category</p>
          </div>

          {processingDocs > 0 && (
            <span className="tag tag-amber" style={{ fontSize: 11, gap: 5 }}>
              <span className="dot dot-amber" /> {processingDocs} processing in background…
            </span>
          )}
        </div>

        {/* Categories Pills */}
        {documents.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`tag ${selectedCategory === cat ? 'tag-accent' : 'tag-neutral'}`}
                style={{ cursor: 'pointer', padding: '5px 12px', fontSize: 12 }}
              >
                📁 {cat} ({cat === 'All' ? documents.length : documents.filter(d => (d.category || 'General') === cat).length})
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <LoadingSpinner size="lg" text="Loading your documents..." />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '36px 0', textAlign: 'center' }}>
            <FileText size={32} style={{ color: 'var(--text3)' }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No documents in "{selectedCategory}"</p>
              <p style={{ fontSize: 12.5, color: 'var(--text2)', marginTop: 4 }}>Upload your PDF notes to begin grounding AI answers.</p>
            </div>
            <button onClick={() => setShowUpload(true)} className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>
              <Plus size={13} /> Upload PDF
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {filteredDocs.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                existingCategories={categories.filter((c) => c !== 'All')}
                onDelete={handleDelete}
                onUpdate={fetchDocuments}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
