import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, ArrowRight, X, AlertTriangle } from 'lucide-react'
import axios from 'axios'
import { submitPaper, submitPaperFile } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'

export function PaperSubmit() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [paperText, setPaperText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'paste' | 'upload'>('paste')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!session.assignmentId || !session.studentName) {
      navigate('/')
    }
  }, [session, navigate])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ]
    if (!validTypes.includes(file.type)) {
      setError('Please upload a .docx, .pdf, or .txt file')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB')
      return
    }

    setSelectedFile(file)
    setError(null)
  }

  const handleSubmitClick = () => {
    if (mode === 'paste' && paperText.trim().length < 100) {
      setError('Your paper must be at least 100 characters')
      return
    }

    if (mode === 'upload' && !selectedFile) {
      setError('Please select a file to upload')
      return
    }

    setShowConfirm(true)
  }

  const handleConfirmedSubmit = async () => {
    setShowConfirm(false)
    setLoading(true)
    setError(null)

    try {
      let response
      if (mode === 'paste') {
        response = await submitPaper(
          session.assignmentId!,
          session.studentName!,
          paperText.trim()
        )
      } else {
        response = await submitPaperFile(
          session.assignmentId!,
          session.studentName!,
          selectedFile!
        )
      }

      setSession({
        ...session,
        submissionId: response.submission_id,
        sessionToken: response.session_token,
      })

      navigate('/quiz-loading')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 422) {
          setError('Your paper is too long to process. Please shorten it to under 100,000 characters and try again.')
        } else {
          setError(err.response?.data?.detail || 'Failed to submit paper. Please try again.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!session.assignmentId) {
    return null
  }

  return (
    <div className="min-h-screen p-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display text-brand mb-2">Submit Your Paper</h1>
          <p className="text-brand/50">{session.assignmentName}</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('paste')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mode === 'paste'
                ? 'btn-ice'
                : 'bg-surface-light text-brand/50 hover:bg-surface-lighter'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
              mode === 'upload'
                ? 'btn-ice'
                : 'bg-surface-light text-brand/50 hover:bg-surface-lighter'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {/* Content Area */}
        <div className="rcnr-card-flat rounded-xl p-6 mb-6">
          {mode === 'paste' ? (
            <div>
              <label className="block text-sm font-medium text-brand/70 mb-2">
                Paste your paper content below
              </label>
              <textarea
                value={paperText}
                onChange={(e) => setPaperText(e.target.value)}
                placeholder="Paste your essay or paper here..."
                rows={15}
                maxLength={100000}
                className="w-full px-4 py-3 rounded-xl bg-surface-light border border-brand/15 text-fg placeholder-fg-dim focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors resize-none"
              />
              <div className="flex justify-between mt-2 text-sm">
                <span className={paperText.length > 95000 ? 'text-amber-400' : 'text-brand/30'}>
                  {paperText.length.toLocaleString()} / 100,000 characters
                </span>
                <span className="text-brand/30">~{paperText.trim() ? paperText.trim().split(/\s+/).length.toLocaleString() : 0} words</span>
              </div>
            </div>
          ) : (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.pdf,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-between p-4 bg-surface-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-brand" />
                    <div>
                      <p className="font-medium text-fg">{selectedFile.name}</p>
                      <p className="text-sm text-brand/50">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-brand/50 hover:text-fg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-12 border-2 border-dashed border-brand/20 rounded-xl hover:border-brand/50 transition-colors"
                >
                  <Upload className="w-12 h-12 text-brand/30 mx-auto mb-4" />
                  <p className="text-brand/50 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-brand/30">
                    .docx, .pdf, or .txt (max 10MB)
                  </p>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitClick}
          disabled={loading || (mode === 'paste' ? paperText.length < 100 : !selectedFile)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 btn-ice rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-midnight"></div>
              Submitting...
            </>
          ) : (
            <>
              Submit Paper
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm mt-4">
          {mode === 'paste' && paperText.length > 0 && paperText.trim().length < 100 ? (
            <span className="text-yellow-400">Your paper must be at least 100 characters ({100 - paperText.trim().length} more needed)</span>
          ) : mode === 'upload' && !selectedFile ? (
            <span className="text-brand/30">Select a file to upload</span>
          ) : (
            <span className="text-brand/30">Once you submit, a personalized quiz will be generated from your paper</span>
          )}
        </p>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="rcnr-card-flat rounded-xl p-8 max-w-md w-full text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-display text-brand mb-3">Submit Your Paper?</h2>
            <p className="text-brand/60 text-sm mb-6">
              Once submitted, a quiz will be generated from your paper. You cannot change your paper or restart the quiz after this point.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 rounded-lg bg-surface-light text-brand/70 hover:bg-surface-lighter transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedSubmit}
                className="flex-1 py-3 rounded-lg btn-ice font-medium"
              >
                Submit Paper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
