import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { documentService } from '../services'
import toast from 'react-hot-toast'
import { upload } from '@vercel/blob/client'

/**
 * FileUpload — drag-and-drop PDF uploader with progress indicator.
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
        const existing = new Set(prev.map(file => `${file.name}:${file.size}:${file.lastModified}`))
        const nextFiles = acceptedFiles.filter(file => {
          const key = `${file.name}:${file.size}:${file.lastModified}`
          if (existing.has(key)) return false
          existing.add(key)
          return true
        })
        return [...prev, ...nextFiles]
      })
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  })

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return

    setUploading(true)
    setProgress(0)

    try {
      const uploadedDocs = []
      const failedFiles = []

      // Upload each file separately directly to Vercel Blob from the client
      for (const [index, file] of selectedFiles.entries()) {
        try {
          // 1. Upload direct to Vercel Blob
          const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
          const newBlob = await upload(safeName, file, {
            access: 'public',
            handleUploadUrl: '/api/upload-token',
            multipart: true,
            onUploadProgress: (progressEvent) => {
              const fileProgress = progressEvent.percentage / 100
              setProgress(Math.round(((index + fileProgress) / selectedFiles.length) * 100))
            }
          })

          // 2. Notify backend to process the uploaded blob
          const { data } = await documentService.uploadBlob({
            url: newBlob.url,
            filename: file.name,
            size: file.size
          })
          
          uploadedDocs.push(data.document)
          setProgress(Math.round(((index + 1) / selectedFiles.length) * 100))
        } catch (error) {
          console.error(error)
          failedFiles.push(`${file.name} (${error.message || 'Unknown'})`)
        }
      }

      if (uploadedDocs.length === 0) {
        throw new Error(failedFiles.length ? `Could not upload: ${failedFiles.join(', ')}` : 'No files were uploaded.')
      }

      toast.success(`${uploadedDocs.length} PDF${uploadedDocs.length === 1 ? '' : 's'} uploaded successfully.`)
      if (failedFiles.length > 0) {
        toast.error(`Skipped ${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'}: ${failedFiles.join(', ')}`)
      }
      setSelectedFiles([])
      setProgress(100)
      onUploadSuccess?.(uploadedDocs)
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Upload failed. Please try again.')
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
              {isDragActive ? 'Drop your PDFs here!' : 'Drag & drop your PDFs'}
            </p>
            <p className="text-xs text-slate-500 mt-1">or click to browse · Max 10 MB</p>
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
            <span>Uploading PDF {Math.min(selectedFiles.length, Math.floor((progress / 100) * selectedFiles.length) + 1)} of {selectedFiles.length}...</span>
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
          Upload {selectedFiles.length} PDF{selectedFiles.length > 1 ? 's' : ''}
        </button>
      )}
    </div>
  )
}
