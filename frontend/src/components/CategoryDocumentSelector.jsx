import { useState } from 'react'
import { FileText, Folder, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react'

export default function CategoryDocumentSelector({ documents, selectedIds, onToggleDoc, onSelectAll }) {
  const [collapsedCategories, setCollapsedCategories] = useState({})

  // Group documents by category
  const grouped = documents.reduce((acc, doc) => {
    const cat = doc.category || 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(doc)
    return acc
  }, {})

  const toggleCollapse = (cat) => {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  const handleToggleCategory = (catDocIds, select) => {
    if (select) {
      onSelectAll(Array.from(new Set([...selectedIds, ...catDocIds])))
    } else {
      onSelectAll(selectedIds.filter(id => !catDocIds.includes(id)))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
      {Object.entries(grouped).map(([cat, docs]) => {
        const catDocIds = docs.map((d) => d.id)
        const allSelected = catDocIds.every((id) => selectedIds.includes(id))
        const isCollapsed = collapsedCategories[cat]

        return (
          <div key={cat} style={{ borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', overflow: 'hidden' }}>
            {/* Category Header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'var(--surface2)', cursor: 'pointer',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => toggleCollapse(cat)}>
                {isCollapsed ? <ChevronRight size={13} style={{ color: 'var(--text3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--text3)' }} />}
                <Folder size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{cat}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500 }}>({docs.length})</span>
              </div>

              {/* Master Select All Checkbox for Category */}
              <button
                type="button"
                onClick={() => handleToggleCategory(catDocIds, !allSelected)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                  color: 'var(--accent)', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                {allSelected ? <CheckSquare size={13} style={{ color: 'var(--accent)' }} /> : <Square size={13} style={{ color: 'var(--text3)' }} />}
                <span>{allSelected ? 'Deselect Category' : 'Select Category'}</span>
              </button>
            </div>

            {/* Document Checkboxes */}
            {!isCollapsed && (
              <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)' }}>
                {docs.map((doc) => {
                  const isSelected = selectedIds.includes(doc.id)
                  return (
                    <label
                      key={doc.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
                        borderRadius: 7, cursor: 'pointer', transition: 'all 0.15s',
                        background: isSelected ? 'var(--accent-dim)' : 'transparent',
                        border: isSelected ? '1px solid var(--accent)' : '1px solid transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleDoc(doc.id)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                      />
                      <FileText size={13} style={{ color: isSelected ? 'var(--accent)' : 'var(--text3)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 500, color: isSelected ? 'var(--accent)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {doc.filename}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
