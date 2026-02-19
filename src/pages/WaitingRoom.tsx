import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, XCircle, ArrowLeft } from 'lucide-react'
import { pollEntryStatus } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'

const POLL_INTERVAL_MS = 3000

export function WaitingRoom() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()

  const [denied, setDenied] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Prevent the guard from redirecting to / after we've handled approval
  const resolvedRef = useRef(false)

  const entryRequestId = sessionStorage.getItem('proveit_entry_request_id')

  // Guard: redirect to entry if no entry request ID (and not already resolved)
  useEffect(() => {
    if (!entryRequestId && !resolvedRef.current) {
      navigate('/')
    }
  }, [entryRequestId, navigate])

  // Stable handler for approval -- uses functional updater so it doesn't depend on session
  const handleApproval = useCallback((data: {
    assignment_id?: string
    assignment_name?: string
    instructions?: string | null
    outline_fields?: { label: string; order: number }[]
    time_limit_minutes?: number
    question_count?: number
  }) => {
    resolvedRef.current = true
    sessionStorage.removeItem('proveit_entry_request_id')

    setSession((prev) => ({
      ...prev,
      assignmentId: data.assignment_id,
      assignmentName: data.assignment_name,
      instructions: data.instructions,
      outlineFields: data.outline_fields || [],
      timeLimitMinutes: data.time_limit_minutes,
      questionCount: data.question_count,
    }))

    navigate('/instructions')
  }, [setSession, navigate])

  // Poll for approval
  useEffect(() => {
    if (!entryRequestId || resolvedRef.current) return

    const poll = async () => {
      try {
        const data = await pollEntryStatus(entryRequestId)

        if (data.status === 'approved') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          handleApproval(data)
        } else if (data.status === 'denied') {
          if (intervalRef.current) clearInterval(intervalRef.current)
          resolvedRef.current = true
          sessionStorage.removeItem('proveit_entry_request_id')
          setDenied(true)
        }
      } catch {
        // Silently retry on network errors
      }
    }

    // Poll immediately, then on interval
    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [entryRequestId, handleApproval])

  if (!entryRequestId && !denied && !resolvedRef.current) {
    return null
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-card rounded-xl p-8">
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />

            <h1 className="text-2xl font-display text-brand mb-2">
              Entry Denied
            </h1>

            <p className="text-brand/50 mb-6">
              Your teacher did not approve your entry request. If this was a mistake, you can try again.
            </p>

            <button
              onClick={() => {
                resolvedRef.current = false
                setDenied(false)
                navigate('/')
              }}
              className="flex items-center justify-center gap-2 w-full px-6 py-3 btn-ice rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Entry
            </button>
          </div>

          <p className="text-xs text-brand/30 mt-6">
            RCNR Teacher Toolbox | ProveIt
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="glass-card rounded-xl p-8">
          <div className="relative mx-auto mb-6 w-20 h-20">
            <Clock className="w-20 h-20 text-brand/40" />
            <div className="absolute inset-0 animate-ping">
              <Clock className="w-20 h-20 text-brand/10" />
            </div>
          </div>

          <h1 className="text-2xl font-display text-brand mb-2">
            Waiting for Approval
          </h1>

          <p className="text-brand/50 mb-6">
            Your teacher needs to approve your entry before you can begin.
          </p>

          {session.studentName && (
            <div className="p-4 bg-surface-light rounded-xl mb-4">
              <p className="text-sm text-brand/40 mb-1">Student</p>
              <p className="text-white font-medium">{session.studentName}</p>
            </div>
          )}

          {session.assignmentName && (
            <div className="p-4 bg-surface-light rounded-xl mb-6">
              <p className="text-sm text-brand/40 mb-1">Assignment</p>
              <p className="text-white font-medium">{session.assignmentName}</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-brand/30 text-sm">
            <div className="w-2 h-2 rounded-full bg-brand/30 animate-pulse" />
            Checking every few seconds...
          </div>
        </div>

        <button
          onClick={() => {
            sessionStorage.removeItem('proveit_entry_request_id')
            navigate('/')
          }}
          className="mt-4 text-sm text-brand/30 hover:text-brand/50 transition-colors"
        >
          Cancel and go back
        </button>

        <p className="text-xs text-brand/30 mt-4">
          RCNR Teacher Toolbox | ProveIt
        </p>
      </div>
    </div>
  )
}
