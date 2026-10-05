import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X } from 'lucide-react'
import { documentService } from '../services'
import toast from 'react-hot-toast'

/**
 * FileUpload - drag-and-drop PDF uploader.
 * Each PDF is read in the browser (pdf.js, with Gemini vision for scanned pages)
 * and its text is saved to Firestore; the PDF file itself is never uploaded.
 */
export default function FileUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState([])

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Only PDF files up to 10MB are allowed.')
    }
    if (acceptedFiles.length > 0) {
      setSelectedFiles(prev => {
        const existing = new Set(prev.map(f => `${f.name}:${f.size}:${f.lastModified}`))
        const next = acceptedFiles.filter(f => {
          const key = `${f.name}:${f.size}:${f.lastModified}`
          if (existing.has(key)) return false
          existing.add(key)
          return true
        })
        return [...prev, ...next]
      })
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  })

  const uploadFile = async (file, fileIndex, totalFiles) => {
    const { data } = await documentService.upload(file, (fileProgress) => {
      setProgress(Math.round(((fileIndex + fileProgress) / totalFiles) * 100))
    })
    return data
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setProgress(0)

    try {
      const uploadedDocs = []
      const failedFiles = []

      for (const [index, file] of selectedFiles.entries()) {
        try {
          const doc = await uploadFile(file, index, selectedFiles.length)
          if (doc) uploadedDocs.push(doc)
        } catch (error) {
          console.error(error)
          const msg = error?.response?.data?.detail || error.message || 'Unknown error'
          failedFiles.push(`${file.name} (${msg})`)
        }
      }

      if (uploadedDocs.length === 0) {
        throw new Error(failedFiles.length ? `Failed: ${failedFiles.join(' | ')}` : 'No files uploaded.')
      }

      toast.success(`${uploadedDocs.length} PDF${uploadedDocs.length === 1 ? '' : 's'} uploaded!`)
      if (failedFiles.length > 0) {
        toast.error(`Skipped: ${failedFiles.join(', ')}`)
      }

      setSelectedFiles([])
      setProgress(100)
      onUploadSuccess?.(uploadedDocs)
    } catch (err) {
      toast.error(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        id="file-dropzone"
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
                    transition-all duration-300
                    ${isDragActive
            ? 'border-brand-500 bg-brand-500/10 scale-[1.02]'
            : 'border-white/10 hover:border-brand-500/50 hover:bg-white/3'
          }`}
      >
        <input {...getInputProps()} id="file-input" />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                          ${isDragActive ? 'bg-brand-500/30' : 'bg-white/5'}`}>
            <Upload size={26} className={isDragActive ? 'text-brand-400' : 'text-slate-400'} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
              {isDragActive ? 'Drop your PDFs here!' : 'Drag & drop your PDFs'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>or click to browse · Max 10 MB</p>
          </div>
        </div>
      </div>

      {/* Selected file list */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl animate-fade-in" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-dim)' }}>
                <FileText size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{file.name}</p>
                <p className="text-xs" style={{ color: 'var(--text2)' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              {!uploading && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
                  }}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Uploading…</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-brand rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {selectedFiles.length > 0 && !uploading && (
        <button
          onClick={handleUpload}
          id="upload-submit-btn"
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '11px 16px',
            borderRadius: 'var(--radius)',
            fontWeight: 700,
            fontSize: 13.5,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s'
          }}
        >
          <Upload size={15} /> Upload {selectedFiles.length} PDF{selectedFiles.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
