import { useEffect, useState } from 'react'
import { CheckCircle, ShieldOff } from 'lucide-react'
import { useSession } from '../hooks/useSessionStorage'

export function Confirmation() {
  const { session, clearSession } = useSession()
  const [status] = useState(() => sessionStorage.getItem('proveit_submit_status') || 'completed')

  // Clear session after showing confirmation
  useEffect(() => {
    const timer = setTimeout(() => {
      clearSession()
      sessionStorage.removeItem('proveit_submit_status')
    }, 10000) // Clear after 10 seconds

    return () => clearTimeout(timer)
  }, [clearSession])

  const isLockedOut = status === 'locked_out'

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="glass-card rounded-xl p-8">
          {isLockedOut ? (
            <>
              <ShieldOff className="w-20 h-20 text-red-400 mx-auto mb-6" />

              <h1 className="text-2xl font-display text-brand mb-4">
                Quiz Auto-Submitted
              </h1>

              <p className="text-brand/50 mb-6">
                Your quiz was automatically submitted due to a lockdown violation.
                Your answers have been recorded as-is.
              </p>

              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-6">
                <p className="text-sm text-red-400">
                  If this was a mistake, please contact your teacher to request a reset.
                </p>
              </div>
            </>
          ) : (
            <>
              <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6" />

              <h1 className="text-2xl font-display text-brand mb-4">
                Submission Complete!
              </h1>

              <p className="text-brand/50 mb-6">
                Thank you, {session.studentName || 'Student'}. Your paper and quiz answers have been recorded.
              </p>

              <div className="p-4 bg-surface-light rounded-xl mb-6">
                <p className="text-sm text-brand/50 mb-1">Assignment</p>
                <p className="text-white font-medium">{session.assignmentName || 'Assignment'}</p>
              </div>
            </>
          )}

          <p className="text-brand/30 text-sm">
            You may now close this window.
          </p>
        </div>

        <p className="text-xs text-brand/30 mt-6">
          RCNR Teacher Toolbox | ProveIt
        </p>
      </div>
    </div>
  )
}
