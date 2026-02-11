import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCheck, ArrowRight } from 'lucide-react'
import { verifyCode } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'

export function Entry() {
  const navigate = useNavigate()
  const { setSession } = useSession()

  const [studentName, setStudentName] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!studentName.trim() || !accessCode.trim()) {
      setError('Please enter your name and access code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await verifyCode(accessCode.trim())

      setSession({
        assignmentId: data.assignment_id,
        assignmentName: data.assignment_name,
        instructions: data.instructions,
        outlineFields: data.outline_fields,
        timeLimitMinutes: data.time_limit_minutes,
        questionCount: data.question_count,
        studentName: studentName.trim(),
      })

      navigate('/instructions')
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Invalid or expired access code. Please check with your teacher.')
      } else {
        setError('Failed to verify code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <FileCheck className="w-16 h-16 text-brand mx-auto mb-4" />
          <h1 className="text-3xl font-display text-brand mb-2">ProveIt</h1>
          <p className="text-brand/50">Paper Verification</p>
        </div>

        {/* Form */}
        <div className="glass-card rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-brand/70 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl bg-surface-light border border-brand/15 text-white placeholder-brand/30 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand/70 mb-2">
                Access Code
              </label>
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABCD-1234"
                className="w-full px-4 py-3 rounded-xl bg-surface-light border border-brand/15 text-white placeholder-brand/30 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors font-mono text-lg tracking-wider text-center"
                required
              />
              <p className="mt-2 text-xs text-brand/30">
                Enter the code provided by your teacher
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 btn-ice rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-midnight"></div>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand/30 mt-6">
          RCNR Teacher Toolbox
        </p>
      </div>
    </div>
  )
}
