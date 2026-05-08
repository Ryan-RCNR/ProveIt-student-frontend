import { useEffect, useState } from 'react'
import { CheckCircle, ShieldOff, AlertTriangle } from 'lucide-react'
import { useSession } from '../hooks/useSessionStorage'

export function Confirmation() {
  const { session, clearSession } = useSession()
  const [status] = useState(() => sessionStorage.getItem('proveit_submit_status') || 'completed')
  const [failedAt] = useState(() => sessionStorage.getItem('proveit_failed_at') || '')
  const [submissionId] = useState(() => session.submissionId || '')

  const isLockedOut = status === 'locked_out'
  const isSubmitFailed = status === 'submit_failed'

  // Exit fullscreen on arrival so students can see browser controls
  useEffect(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  // Clear session after showing confirmation — but NOT for submit_failed,
  // because the student needs to keep the screen up for the teacher to
  // see the submission_id + timestamp and trigger a manual reset.
  useEffect(() => {
    if (isSubmitFailed) return
    const timer = setTimeout(() => {
      clearSession()
      sessionStorage.removeItem('proveit_submit_status')
      sessionStorage.removeItem('proveit_failed_at')
      sessionStorage.removeItem('proveit_failed_status')
    }, 30000) // Clear after 30 seconds

    return () => clearTimeout(timer)
  }, [clearSession, isSubmitFailed])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="rcnr-card-flat rounded-xl p-8">
          {isSubmitFailed ? (
            <>
              <AlertTriangle className="w-20 h-20 text-red-400 mx-auto mb-6" />

              <h1 className="text-2xl font-display text-brand mb-4">
                Submission Failed
              </h1>

              <p className="text-brand/70 mb-6">
                Your quiz could not be saved. <strong>Please show this screen to your teacher</strong> and ask them to reset your access so you can re-enter.
              </p>

              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4 text-left">
                <p className="text-xs text-brand/50 mb-1">Submission ID</p>
                <p className="text-fg font-mono text-sm break-all mb-3">{submissionId || 'unknown'}</p>
                <p className="text-xs text-brand/50 mb-1">Attempted at</p>
                <p className="text-fg font-mono text-sm">{failedAt || 'unknown'}</p>
                {session.studentName && (
                  <>
                    <p className="text-xs text-brand/50 mb-1 mt-3">Student</p>
                    <p className="text-fg text-sm">{session.studentName}</p>
                  </>
                )}
                {session.assignmentName && (
                  <>
                    <p className="text-xs text-brand/50 mb-1 mt-3">Assignment</p>
                    <p className="text-fg text-sm">{session.assignmentName}</p>
                  </>
                )}
              </div>

              <p className="text-sm text-red-400">
                Do not close this tab until your teacher has seen it.
              </p>
            </>
          ) : isLockedOut ? (
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

              <p className="text-brand/30 text-sm">
                You may now close this tab.
              </p>
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
                <p className="text-fg font-medium">{session.assignmentName || 'Assignment'}</p>
              </div>

              <p className="text-brand/30 text-sm">
                You may now close this tab.
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-brand/30 mt-6">
          RCNR Teacher Toolbox | ProveIt
        </p>
      </div>
    </div>
  )
}
