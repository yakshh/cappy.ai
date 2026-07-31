import { useState } from 'react'
import { FileText, Trash2, Clock, CheckCircle, XCircle, Loader2, Folder, HardDrive, Layers, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { documentService } from '../services'

function StatusBadge({ status }) {
  const cfg = {
    ready:      { tag: 'tag-green',   icon: CheckCircle, label: 'Ready'      },
    processing: { tag: 'tag-amber',   icon: Loader2,     label: 'Processing' },
    failed:     { tag: 'tag-danger',  icon: XCircle,     label: 'Failed'     },
  }
  const { tag, icon: Icon, label } = cfg[status] || cfg.processing

  return (
    <span className={`tag ${tag}`} style={{ fontSize: 11, padding: '2px 7px', fontWeight: 600 }}>
      <Icon size={11} className={status === 'processing' ? 'animate-spin' : ''} />
      <span>{label}</span>
    </span>
  )
}

/**
 * DocumentCard — Theme-adaptive document card with dropdown category selection & clean meta alignment.
 */
export default function DocumentCard({ doc, existingCategories = [], onDelete, onUpdate }) {
  const [editingCategory, setEditingCategory] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState(doc.category || 'General')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')

  // Build clean unique category options list
  const defaultCats = ['General']
  const allCatOptions = Array.from(new Set([...defaultCats, ...existingCategories])).filter(Boolean)

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return
    try {
      await documentService.delete(doc.id)
      toast.success('Document deleted.')
      onDelete?.(doc.id)
    } catch {
      toast.error('Failed to delete document.')
    }
  }

  const handleSaveCategory = async (catToSave) => {
    const targetCat = catToSave.trim() || 'General'
    try {
      await documentService.updateCategory(doc.id, targetCat)
      toast.success(`Category updated to "${targetCat}"`)
      doc.category = targetCat
      setEditingCategory(false)
      setIsCreatingNew(false)
      onUpdate?.()
    } catch {
      toast.error('Failed to update category.')
    }
  }

  const handleDropdownChange = (e) => {
    const val = e.target.value
    if (val === '__CREATE_NEW__') {
      setIsCreatingNew(true)
      setNewCatInput('')
    } else {
      setSelectedCategory(val)
      handleSaveCategory(val)
    }
  }

  const handleSaveNewCat = () => {
    if (!newCatInput.trim()) {
      toast.error('Category name cannot be empty.')
      return
    }
    handleSaveCategory(newCatInput)
  }

  const fileSizeMB = doc.file_size ? (doc.file_size / (1024 * 1024)).toFixed(2) : '—'
  const parseUTCDate = (dateStr) => {
    if (!dateStr) return new Date()
    return new Date(dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z')
  }
  const timeAgo = doc.created_at
    ? formatDistanceToNow(parseUTCDate(doc.created_at), { addSuffix: true })
    : ''

  return (
    <div
      className="card group anim-in"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        justify: 'space-between',
        gap: 12,
        position: 'relative',
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {/* Top Header: Icon + Title + Delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
        {/* Document Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'var(--accent-dim)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <FileText size={17} style={{ color: 'var(--accent)' }} />
        </div>

        {/* Title */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
          <h3
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
            title={doc.filename}
          >
            {doc.filename}
          </h3>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          id={`delete-doc-${doc.id}`}
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', padding: 4, borderRadius: 6,
            transition: 'color 0.15s, background 0.15s',
          }}
          className="hover:text-rose-500"
          title="Delete document"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Middle Row: Status Badge & Category Selector */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
        <StatusBadge status={doc.status} />

        {editingCategory ? (
          isCreatingNew ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="text"
                placeholder="New Category..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveNewCat()}
                className="input"
                style={{ padding: '2px 8px', fontSize: 11, width: 110 }}
                autoFocus
              />
              <button onClick={handleSaveNewCat} className="btn btn-primary" style={{ padding: '2px 8px', fontSize: 10 }}>
                Save
              </button>
              <button onClick={() => setIsCreatingNew(false)} className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }}>
                Cancel
              </button>
            </div>
          ) : (
            <select
              value={selectedCategory}
              onChange={handleDropdownChange}
              onBlur={() => setEditingCategory(false)}
              className="input"
              style={{
                padding: '2px 8px',
                fontSize: 11,
                width: 'auto',
                minWidth: 120,
                cursor: 'pointer',
                background: 'var(--surface2)',
                color: 'var(--text)',
                borderColor: 'var(--accent)',
              }}
              autoFocus
            >
              {allCatOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__CREATE_NEW__">+ Create New Category...</option>
            </select>
          )
        ) : (
          <button
            onClick={() => { setEditingCategory(true); setIsCreatingNew(false); }}
            className="tag tag-neutral"
            style={{ cursor: 'pointer', fontSize: 11, padding: '2px 7px' }}
            title="Click to select category"
          >
            <Folder size={11} style={{ color: 'var(--accent)' }} />
            <span>{doc.category || 'General'}</span>
          </button>
        )}
      </div>

      {/* Bottom Metadata Row: File Size, Pages, Chunks & Time Ago */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
        fontSize: 11.5,
        color: 'var(--text2)',
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <HardDrive size={11} style={{ color: 'var(--text3)' }} />
            {fileSizeMB} MB
          </span>
          {doc.page_count > 0 && <span>· {doc.page_count} pages</span>}
          {doc.chunk_count > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <Layers size={11} style={{ color: 'var(--text3)' }} />
              {doc.chunk_count} chunks
            </span>
          )}
        </div>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text3)', flexShrink: 0 }}>
          <Clock size={10} />
          {timeAgo}
        </span>
      </div>
    </div>
  )
}
