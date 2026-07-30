import { useState } from 'react'
import { FileText, Folder, ChevronDown, ChevronRight, CheckSquare, Square } from 'lucide-react'

export default function CategoryDocumentSelector({ documents, selectedIds, onToggleDoc, onToggleCategory }) {
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

  return (
    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
      {Object.entries(grouped).map(([cat, docs]) => {
        const catDocIds = docs.map((d) => d.id)
        const allSelected = catDocIds.every((id) => selectedIds.includes(id))
        const isCollapsed = collapsedCategories[cat]

        return (
          <div key={cat} className="rounded-xl border border-white/5 bg-white/5 overflow-hidden">
            {/* Category Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
              <div className="flex items-center gap-2" onClick={() => toggleCollapse(cat)}>
                {isCollapsed ? <ChevronRight size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}
                <Folder size={13} className="text-brand-400" />
                <span className="text-xs font-bold text-white">{cat}</span>
                <span className="text-[10px] text-slate-400 font-medium">({docs.length})</span>
              </div>

              {/* Master Select All Checkbox for Category */}
              <button
                type="button"
                onClick={() => onToggleCategory(catDocIds, !allSelected)}
                className="flex items-center gap-1 text-[11px] text-brand-300 hover:text-white font-medium"
              >
                {allSelected ? <CheckSquare size={13} className="text-brand-400" /> : <Square size={13} className="text-slate-500" />}
                <span>{allSelected ? 'Deselect Category' : 'Select Category'}</span>
              </button>
            </div>

            {/* Document Checkboxes */}
            {!isCollapsed && (
              <div className="p-2 space-y-1 bg-black/10">
                {docs.map((doc) => (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(doc.id)}
                      onChange={() => onToggleDoc(doc.id)}
                      className="accent-brand-500 rounded cursor-pointer"
                    />
                    <FileText size={13} className="text-brand-400 flex-shrink-0" />
                    <span className="text-xs text-slate-300 truncate flex-1">{doc.filename}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
