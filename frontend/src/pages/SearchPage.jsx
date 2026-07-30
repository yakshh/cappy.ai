import { useState } from 'react'
import { searchService } from '../services'
import { Search, FileText, ArrowUpDown, Layers } from 'lucide-react'
import toast from 'react-hot-toast'

const SUGGESTIONS = ['What is MQTT protocol?', 'CoAP vs HTTP', 'Neural network backpropagation', 'Digital Systems flip flops']
const COUNTS = [10, 15, 25, 50]

const scoreLabel = (s) => s >= 0.7 ? ['var(--green)', 'High'] : s >= 0.5 ? ['var(--accent)', 'Good'] : ['var(--amber)', 'Fair']

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'
  const [maxResults, setMaxResults] = useState(15)

  const handleSearch = async (overrideQuery) => {
    const q = (overrideQuery || query).trim()
    if (!q) return
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await searchService.search({ query: q, n_results: maxResults })
      setResults(data.results)
      if (data.results.length === 0) toast('No results found for your query.')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  const sortedResults = [...results].sort((a, b) => {
    return sortOrder === 'desc' ? b.score - a.score : a.score - b.score
  })

  return (
    <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Search Bar Card ── */}
      <div className="card" style={{ padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              id="semantic-search-input"
              className="input"
              style={{ paddingLeft: 38 }}
              placeholder="Type any concept, definition, or question (e.g. What is MQTT protocol?)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>

          {/* Results Count Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 7, padding: '0 6px' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 4, whiteSpace: 'nowrap' }}>Top</span>
            {COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setMaxResults(n)}
                style={{
                  width: 30, height: 28, borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.12s',
                  background: maxResults === n ? 'var(--accent)' : 'transparent',
                  color: maxResults === n ? '#fff' : 'var(--text2)'
                }}
              >
                {n}
              </button>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={() => handleSearch()}
            disabled={!query.trim() || loading}
          >
            {loading ? (
              <><span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Searching...</>
            ) : (
              <><Search size={14} /> Search</>
            )}
          </button>
        </div>
      </div>

      {/* ── Empty State ── */}
      {!searched && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0', textAlign: 'center' }}>
          <Search size={32} style={{ color: 'var(--text3)' }} />
          <div>
            <p className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>Search Study Notes with Vector Math</p>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Semantic search finds conceptual meanings across all your uploaded PDFs.</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginTop: 4 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setQuery(s); handleSearch(s) }}
                className="tag tag-neutral"
                style={{ cursor: 'pointer', fontSize: 12, padding: '5px 12px' }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 40, height: 20, borderRadius: 4 }} />
                <div className="skeleton" style={{ flex: 1, height: 14 }} />
                <div className="skeleton" style={{ width: 60, height: 14 }} />
              </div>
              {[90, 75, 55].map((w, j) => (
                <div key={j} className="skeleton" style={{ height: 12, width: `${w}%`, marginBottom: 7 }} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Results List ── */}
      {searched && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              <strong style={{ color: 'var(--text)' }}>{results.length} results</strong> for "{query}"
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="btn btn-ghost btn-sm"
                style={{ gap: 4 }}
              >
                <ArrowUpDown size={12} /> {sortOrder === 'desc' ? 'Highest Match First' : 'Lowest Match First'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Layers size={11} /> 384D Vector Cosine
              </span>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--text2)' }}>No matching chunks found in vector store.</p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Try searching with broader terms or upload more PDFs.</p>
            </div>
          ) : (
            sortedResults.map((r, rankIdx) => {
              const matchPct = Math.min(100, Math.max(0, Math.round(r.score * 100)))
              const [scoreColor, scoreLabel_] = scoreLabel(r.score)

              return (
                <div key={rankIdx} className="card anim-in" style={{ padding: 18, marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    
                    {/* Rank Badge */}
                    <span style={{
                      width: 26, height: 26, borderRadius: 6, background: 'var(--surface2)',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 700, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Grotesk'
                    }}>
                      #{rankIdx + 1}
                    </span>

                    {/* Document Meta & Snippet */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span className="tag tag-accent" style={{ fontSize: 11.5 }}>
                          <FileText size={11} /> {r.document_name}
                        </span>
                        {r.page && <span style={{ fontSize: 11, color: 'var(--text3)' }}>p.{r.page}</span>}
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>
                        {r.text}
                      </p>
                    </div>

                    {/* Score Bar & Pill */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: scoreColor }}>{matchPct}%</span>
                      <span style={{ fontSize: 10, color: scoreColor, background: scoreColor + '18', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                        {scoreLabel_}
                      </span>
                    </div>

                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
