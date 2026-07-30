import { FileText } from 'lucide-react'

/**
 * SourceCitationCard — shows which document and page an AI answer came from.
 */
export default function SourceCitationCard({ sources }) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sources</p>
      <div className="flex flex-wrap gap-2">
        {sources.map((src, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                       bg-brand-500/10 border border-brand-500/20
                       text-xs text-brand-300"
          >
            <FileText size={12} className="text-brand-400 flex-shrink-0" />
            <span className="font-medium truncate max-w-[150px]">{src.document_name}</span>
            <span className="text-brand-500">·</span>
            <span className="text-slate-400">pg {src.page}</span>
            {src.score > 0 && (
              <>
                <span className="text-brand-500">·</span>
                <span className="text-slate-500">{Math.round(src.score * 100)}%</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
