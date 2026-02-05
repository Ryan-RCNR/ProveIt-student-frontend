import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'
import { useSession } from '../hooks/useSessionStorage'

export function Confirmation() {
  const { session, clearSession } = useSession()

  // Clear session after showing confirmation
  useEffect(() => {
    const timer = setTimeout(() => {
      clearSession()
    }, 10000) // Clear after 10 seconds

    return () => clearTimeout(timer)
  }, [clearSession])

  return (
    <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="glass rounded-xl p-8">
          <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6" />

          <h1 className="text-2xl font-display text-white mb-4">
            Submission Complete!
          </h1>

          <p className="text-gray-400 mb-6">
            Thank you, {session.studentName || 'Student'}. Your paper and quiz answers have been recorded.
          </p>

          <div className="p-4 bg-white/5 rounded-lg mb-6">
            <p className="text-sm text-gray-400 mb-1">Assignment</p>
            <p className="text-white font-medium">{session.assignmentName || 'Assignment'}</p>
          </div>

          <p className="text-gray-500 text-sm">
            You may now close this window.
          </p>
        </div>

        <p className="text-xs text-gray-600 mt-6">
          RCNR Teacher Toolbox | ProveIt
        </p>
      </div>
    </div>
  )
}
