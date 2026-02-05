import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, ArrowRight, X } from 'lucide-react'
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

  const handleSubmit = async () => {
    if (mode === 'paste' && paperText.trim().length < 100) {
      setError('Your paper must be at least 100 characters')
      return
    }

    if (mode === 'upload' && !selectedFile) {
      setError('Please select a file to upload')
      return
    }

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
        quizQuestions: response.quiz_questions,
        startedAt: response.started_at,
      })

      navigate('/quiz')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to submit paper. Please try again.')
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
    <div className="min-h-screen bg-midnight p-4 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-display text-white mb-2">Submit Your Paper</h1>
          <p className="text-gray-400">{session.assignmentName}</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode('paste')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              mode === 'paste'
                ? 'bg-ice text-deep-sea'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              mode === 'upload'
                ? 'bg-ice text-deep-sea'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
            {error}
          </div>
        )}

        {/* Content Area */}
        <div className="glass rounded-xl p-6 mb-6">
          {mode === 'paste' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Paste your paper content below
              </label>
              <textarea
                value={paperText}
                onChange={(e) => setPaperText(e.target.value)}
                placeholder="Paste your essay or paper here..."
                rows={15}
                className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-ice focus:ring-1 focus:ring-ice focus:outline-none transition-colors resize-none"
              />
              <div className="flex justify-between mt-2 text-sm text-gray-500">
                <span>{paperText.length} characters</span>
                <span>~{Math.round(paperText.split(/\s+/).length)} words</span>
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
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-ice" />
                    <div>
                      <p className="font-medium text-white">{selectedFile.name}</p>
                      <p className="text-sm text-gray-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-12 border-2 border-dashed border-white/20 rounded-lg hover:border-ice/50 transition-colors"
                >
                  <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-gray-500">
                    .docx, .pdf, or .txt (max 10MB)
                  </p>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || (mode === 'paste' ? paperText.length < 100 : !selectedFile)}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-ice text-deep-sea font-semibold rounded-lg hover:bg-ice-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-deep-sea"></div>
              Processing...
            </>
          ) : (
            <>
              Continue to Quiz
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <p className="text-center text-sm text-gray-500 mt-4">
          Once you continue, the timed quiz will begin
        </p>
      </div>
    </div>
  )
}
