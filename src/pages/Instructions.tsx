import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Lock, AlertTriangle } from 'lucide-react'
import { useSession } from '../hooks/useSessionStorage'

export function Instructions() {
  const navigate = useNavigate()
  const { session } = useSession()

  useEffect(() => {
    if (!session.assignmentId) {
      navigate('/')
    }
  }, [session, navigate])

  if (!session.assignmentId) {
    return null
  }

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="glass-card rounded-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display text-brand mb-2">{session.assignmentName}</h1>
            <p className="text-brand/50">Welcome, {session.studentName}</p>
          </div>

          {/* Instructions */}
          {session.instructions && (
            <div className="mb-8 p-4 bg-surface-light rounded-xl">
              <p className="text-brand/70">{session.instructions}</p>
            </div>
          )}

          {/* What to expect */}
          <div className="space-y-4 mb-8">
            <h2 className="text-lg font-semibold text-brand">What to expect:</h2>

            <div className="flex items-start gap-4 p-4 bg-surface-light rounded-xl">
              <FileText className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">1. Submit Your Paper</h3>
                <p className="text-sm text-brand/50">
                  Paste your paper text or upload your document (.docx, .pdf)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-surface-light rounded-xl">
              <Lock className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">2. Complete the Quiz</h3>
                <p className="text-sm text-brand/50">
                  Answer {session.questionCount} questions about your paper in lockdown mode
                  ({session.timeLimitMinutes} minutes)
                </p>
              </div>
            </div>

            {session.outlineFields && session.outlineFields.length > 0 && (
              <div className="flex items-start gap-4 p-4 bg-surface-light rounded-xl">
                <FileText className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-white mb-1">3. Outline Responses</h3>
                  <p className="text-sm text-brand/50">
                    Answer {session.outlineFields.length} reflection questions about your work
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl mb-8">
            <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-400 mb-1">Important:</p>
              <ul className="text-brand/70 space-y-1">
                <li>Once you start the quiz, the timer begins immediately</li>
                <li>Switching tabs or windows will be logged</li>
                <li>Copy/paste is disabled during the quiz</li>
                <li>Your answers are auto-saved as you go</li>
              </ul>
            </div>
          </div>

          {/* Time estimate */}
          <div className="flex items-center justify-center gap-2 text-brand/50 mb-8">
            <Clock className="w-4 h-4" />
            <span>Time limit: {session.timeLimitMinutes} minutes</span>
          </div>

          {/* Start button */}
          <button
            onClick={() => navigate('/submit')}
            className="w-full px-6 py-4 btn-ice rounded-lg text-lg"
          >
            I'm Ready - Start Assignment
          </button>
        </div>
      </div>
    </div>
  )
}
