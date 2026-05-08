import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import * as Sentry from '@sentry/react'
import { pollQuizReady, regenerateQuiz } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'

const MAX_CLIENT_RETRIES = 3

export function QuizLoading() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [terminal, setTerminal] = useState(false) // true = no more retry button
  const [retrying, setRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

  const startPolling = useCallback(() => {
    const poll = async () => {
      if (!mountedRef.current) return
      try {
        const data = await pollQuizReady(session.submissionId!)
        if (!mountedRef.current) return

        if (data.quiz_status === 'ready' && data.quiz_questions) {
          // Quiz is ready -- store questions and navigate to lockdown quiz
          setSession((prev) => ({
            ...prev,
            quizQuestions: data.quiz_questions,
            startedAt: data.started_at,
            timeLimitMinutes: data.time_limit_minutes,
          }))
          navigate('/quiz')
        } else if (data.quiz_status === 'failed') {
          setError('Quiz generation failed. Your paper is saved — try again to retry without re-entering it.')
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
        // "generating" -- keep polling
      } catch (err: any) {
        if (err.response?.status === 410) {
          // Assignment was closed by teacher while quiz was generating
          setError('This assignment has been closed by your teacher.')
          setTerminal(true)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
          return
        }
        // Other network hiccups -- keep polling
      }
    }
    poll()
    intervalRef.current = setInterval(poll, 3000)
  }, [session.submissionId, setSession, navigate])

  const handleRetry = useCallback(async () => {
    if (retrying || terminal || !session.submissionId) return
    setRetrying(true)
    Sentry.addBreadcrumb({
      category: 'proveit',
      message: 'quiz_regenerate',
      data: { attempt: retryCount + 1 },
      level: 'info',
    })
    try {
      await regenerateQuiz(session.submissionId)
      const nextCount = retryCount + 1
      setRetryCount(nextCount)
      setError(null)
      // Resume polling — _run_quiz_generation BG task is now firing again
      startPolling()
      if (nextCount >= MAX_CLIENT_RETRIES) {
        // After this attempt, no more button — caps abuse and signals teacher attention
        setTerminal(true)
      }
    } catch (err: any) {
      if (err.response?.status === 410) {
        setError('This assignment has been closed by your teacher.')
        setTerminal(true)
      } else if (err.response?.status === 429) {
        setError('Too many retries — please wait a minute and try again, or contact your teacher.')
      } else {
        setError('Could not retry — please contact your teacher.')
        setTerminal(true)
      }
    } finally {
      setRetrying(false)
    }
  }, [retrying, terminal, session.submissionId, retryCount, startPolling])

  useEffect(() => {
    if (!session.submissionId) {
      navigate('/')
      return
    }

    mountedRef.current = true

    // Elapsed timer (updates every second)
    timerRef.current = setInterval(() => {
      if (mountedRef.current) setElapsed(prev => prev + 1)
    }, 1000)

    startPolling()

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session.submissionId) return null

  const showRetryButton = error && !terminal
  const showContactTeacher = terminal && retryCount >= MAX_CLIENT_RETRIES

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rcnr-card-flat rounded-xl p-8 text-center">
          {error ? (
            <>
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-display text-fg mb-2">Quiz Generation Failed</h1>
              <p className="text-brand/50 mb-6">{error}</p>
              {showRetryButton && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center justify-center gap-2 mx-auto px-6 py-3 btn-ice rounded-lg disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  {retrying ? 'Retrying…' : 'Try Again'}
                </button>
              )}
              {showContactTeacher && (
                <p className="text-sm text-brand/40 mt-2">Please contact your teacher.</p>
              )}
            </>
          ) : (
            <>
              <Loader2 className="w-12 h-12 text-brand mx-auto mb-4 animate-spin" />
              <h1 className="text-xl font-display text-brand mb-2">
                Generating Your Quiz
              </h1>
              <p className="text-brand/50 mb-6">
                Analyzing your paper and creating personalized questions...
              </p>

              {/* Progress dots */}
              <div className="flex justify-center gap-2 mb-6">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-brand/40 animate-pulse"
                    style={{ animationDelay: `${i * 0.3}s` }}
                  />
                ))}
              </div>

              <p className="text-sm text-brand/30">
                {elapsed < 10
                  ? 'This usually takes 15-30 seconds...'
                  : elapsed < 30
                    ? 'Still working...'
                    : elapsed < 60
                      ? 'Almost there...'
                      : 'Taking a bit longer than usual...'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
