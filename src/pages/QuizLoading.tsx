import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { pollQuizReady } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'

export function QuizLoading() {
  const navigate = useNavigate()
  const { session, setSession } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mountedRef = useRef(true)

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

    // Poll every 3 seconds
    const poll = async () => {
      if (!mountedRef.current) return
      try {
        const data = await pollQuizReady(session.submissionId!)
        if (!mountedRef.current) return

        if (data.quiz_status === 'ready' && data.quiz_questions) {
          // Quiz is ready -- store questions and navigate to lockdown quiz
          setSession({
            ...session,
            quizQuestions: data.quiz_questions,
            startedAt: data.started_at,
            timeLimitMinutes: data.time_limit_minutes,
          })
          navigate('/quiz')
        } else if (data.quiz_status === 'failed') {
          setError('Quiz generation failed. Please go back and resubmit your paper.')
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
        // "generating" -- keep polling
      } catch (err: any) {
        if (err.response?.status === 410) {
          // Assignment was closed by teacher while quiz was generating
          setError('This assignment has been closed by your teacher.')
          if (intervalRef.current) clearInterval(intervalRef.current)
          return
        }
        // Other network hiccups -- keep polling
      }
    }

    // Initial poll
    poll()
    intervalRef.current = setInterval(poll, 3000)

    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session.submissionId) return null

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="glass-card rounded-xl p-8 text-center">
          {error ? (
            <>
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h1 className="text-xl font-display text-white mb-2">Quiz Generation Failed</h1>
              <p className="text-brand/50 mb-6">{error}</p>
              <button
                onClick={() => navigate('/submit')}
                className="flex items-center justify-center gap-2 mx-auto px-6 py-3 btn-ice rounded-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
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
