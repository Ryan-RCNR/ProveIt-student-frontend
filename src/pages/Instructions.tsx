import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, FileText, Lock, AlertTriangle } from 'lucide-react'
import { useSession } from '../hooks/useSessionStorage'

function getIsExtended(): boolean | null {
  if (typeof window !== 'undefined' && 'isExtended' in window.screen) {
    return (window.screen as Screen & { isExtended: boolean }).isExtended
  }
  return null
}

export function Instructions() {
  const navigate = useNavigate()
  const { session } = useSession()
  const requireSingleMonitor = !!session.requireSingleMonitor
  const [multiMonitor, setMultiMonitor] = useState(() => requireSingleMonitor && getIsExtended() === true)

  useEffect(() => {
    if (!session.assignmentId) {
      navigate('/')
    }
  }, [session, navigate])

  // Poll for monitor count changes every 2s
  useEffect(() => {
    if (!requireSingleMonitor) return
    const interval = setInterval(() => setMultiMonitor(getIsExtended() === true), 2000)
    return () => clearInterval(interval)
  }, [requireSingleMonitor])

  if (!session.assignmentId) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="rcnr-card-flat rounded-xl p-8">
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
                <h3 className="font-medium text-fg mb-1">1. Submit Your Paper</h3>
                <p className="text-sm text-brand/50">
                  Paste your paper text or upload your document (.docx, .pdf)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-surface-light rounded-xl">
              <Lock className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-fg mb-1">2. Complete the Quiz</h3>
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
                  <h3 className="font-medium text-fg mb-1">3. Outline Responses</h3>
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
                <li>Switching tabs, windows, or leaving fullscreen will auto-submit your quiz as-is</li>
                <li>Copy/paste is disabled during the quiz</li>
                <li>Your teacher can reset your submission if needed</li>
              </ul>
            </div>
          </div>

          {/* Time estimate */}
          <div className="flex items-center justify-center gap-2 text-brand/50 mb-8">
            <Clock className="w-4 h-4" />
            <span>Time limit: {session.timeLimitMinutes} minutes</span>
          </div>

          {/* Multi-monitor blocker */}
          {requireSingleMonitor && multiMonitor && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/8 p-4">
              <p className="text-sm font-medium text-red-400 mb-1">Second monitor detected</p>
              <p className="text-xs text-red-400/70 leading-relaxed">
                Please disconnect your second monitor before beginning. This session requires a single screen.
              </p>
              <div className="mt-2 flex items-center gap-2 text-xs text-red-400/50">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Checking every few seconds...
              </div>
            </div>
          )}

          {/* Start button */}
          <button
            onClick={() => navigate('/submit')}
            disabled={requireSingleMonitor && multiMonitor}
            className="w-full px-6 py-4 btn-ice rounded-lg text-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            I'm Ready - Start Assignment
          </button>
        </div>
      </div>
    </div>
  )
}
