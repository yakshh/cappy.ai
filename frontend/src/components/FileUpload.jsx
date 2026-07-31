import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { documentService } from '../services'
import toast from 'react-hot-toast'

/**
 * FileUpload — drag-and-drop PDF uploader with progress indicator.
 */
export default function FileUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState([])

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Only PDF files up to 15MB are allowed.')
    }
    if (acceptedFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...acceptedFiles])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 15 * 1024 * 1024,
    multiple: true,
  })

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setProgress(0)

    const formData = new FormData()
    selectedFiles.forEach(file => {
      formData.append('files', file)
    })

    try {
      const { data } = await documentService.upload(formData, (progressEvent) => {
        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        setProgress(pct)
      })
      toast.success(data.message)
      setSelectedFiles([])
      setProgress(0)
      onUploadSuccess?.(data.documents)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Please try again.')
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
            <p className="text-sm font-medium text-white">
              {isDragActive ? 'Drop your PDF here!' : 'Drag & drop your PDF'}
            </p>
            <p className="text-xs text-slate-500 mt-1">or click to browse · Max 15 MB</p>
          </div>
        </div>
      </div>

      {/* Selected file preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          {selectedFiles.map((file, idx) => (
            <div key={idx} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
              <div className="w-9 h-9 rounded-lg bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
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

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Uploading...</span>
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
          className="btn-primary w-full"
        >
          Upload PDF{selectedFiles.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
