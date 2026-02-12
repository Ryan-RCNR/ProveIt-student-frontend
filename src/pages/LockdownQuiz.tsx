import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Monitor, Maximize } from 'lucide-react'
import axios from 'axios'
import { submitQuiz, LockdownEvent, QuizQuestion as QuizQuestionType } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'
import { useLockdown, Violation } from '../hooks/useLockdown'
import { QuizTimer } from '../components/QuizTimer'
import { QuizQuestion } from '../components/QuizQuestion'

const AUTOSAVE_DEBOUNCE_MS = 1000

export function LockdownQuiz() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [outlineResponses, setOutlineResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if no session
  useEffect(() => {
    if (!session.startedAt || !session.timeLimitMinutes) {
      navigate('/')
    }
  }, [session.startedAt, session.timeLimitMinutes, navigate])

  const handleSubmit = useCallback(async (forced: boolean = false, lockdownForced: boolean = false) => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const answersList = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      }))

      const outlineList = Object.entries(outlineResponses).map(([field_label, response]) => ({
        field_label,
        response,
      }))

      // Convert violations to LockdownEvent format for the API
      const lockdownEvents: LockdownEvent[] = violationsRef.current.map((v) => ({
        type: v.type as LockdownEvent['type'],
        timestamp: v.timestamp,
        count: v.count,
      }))

      const response = await submitQuiz(
        session.submissionId!,
        session.sessionToken!,
        answersList,
        outlineList,
        lockdownEvents,
        forced,
        lockdownForced
      )

      // Store submission status for confirmation page
      sessionStorage.setItem('proveit_submit_status', response.status)
      sessionStorage.removeItem('proveit_autosave')
      navigate('/complete')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to submit. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }, [answers, outlineResponses, session.submissionId, session.sessionToken, loading, navigate])

  // Keep a ref to violations so handleSubmit can access current list without re-rendering
  const violationsRef = useCallback(() => ({ current: [] as Violation[] }), [])()

  const handleAutoSubmit = useCallback(() => {
    handleSubmit(true, true) // forced + lockdown-caused
  }, [handleSubmit])

  const handleTimeUp = useCallback(() => {
    handleSubmit(true, false) // forced by timer, NOT lockdown
  }, [handleSubmit])

  // Lockdown
  const {
    isFullscreen,
    isMobileDevice,
    violations,
    warning,
    fullscreenCountdown,
    enterFullscreen,
  } = useLockdown({
    onAutoSubmit: handleAutoSubmit,
    enabled: true,
  })

  // Keep violations ref in sync
  useEffect(() => {
    violationsRef.current = violations
  }, [violations, violationsRef])

  // Enter fullscreen on mount
  useEffect(() => {
    enterFullscreen()
  }, [enterFullscreen])

  // Auto-save to session storage (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const saveData = {
        answers,
        outlineResponses,
      }
      sessionStorage.setItem('proveit_autosave', JSON.stringify(saveData))
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [answers, outlineResponses])

  // Load auto-saved data
  useEffect(() => {
    const saved = sessionStorage.getItem('proveit_autosave')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.answers) setAnswers(data.answers)
        if (data.outlineResponses) setOutlineResponses(data.outlineResponses)
      } catch (e) {
        console.warn('Failed to parse autosaved data, starting fresh:', e)
      }
    }
  }, [])

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  if (!session.quizQuestions || !session.submissionId || !session.sessionToken || !session.startedAt || !session.timeLimitMinutes) {
    return null
  }

  // Mobile device gate
  if (isMobileDevice) {
    return (
      <div className="min-h-screen bg-midnight flex items-center justify-center p-4">
        <div className="glass-card rounded-xl p-8 max-w-md text-center">
          <Monitor className="w-16 h-16 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-display text-brand mb-4">Computer Required</h1>
          <p className="text-brand/50 mb-2">
            This quiz must be taken on a computer with fullscreen support.
          </p>
          <p className="text-brand/30 text-sm">
            Please open this page on a laptop or desktop computer.
          </p>
        </div>
      </div>
    )
  }

  const questions = session.quizQuestions as QuizQuestionType[]
  const outlineFields = session.outlineFields || []
  const totalQuestions = questions.length
  const totalOutlineFields = outlineFields.length
  const totalItemsToAnswer = totalQuestions + totalOutlineFields
  const answeredCount = Object.keys(answers).length + Object.keys(outlineResponses).length

  return (
    <div className="min-h-screen bg-midnight">
      {/* Fixed Timer Header */}
      <div className="fixed top-0 left-0 right-0 bg-surface border-b border-brand/15 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <QuizTimer
              startedAt={session.startedAt}
              timeLimitMinutes={session.timeLimitMinutes}
              onTimeUp={handleTimeUp}
              onWarning={() => {}}
            />
            <span className="text-sm text-brand/50">
              {answeredCount} / {totalItemsToAnswer} answered
            </span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="px-4 py-2 btn-ice rounded-lg disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>

      {/* Warning Toast */}
      {warning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            {warning}
          </div>
        </div>
      )}

      {/* Fullscreen Re-entry Overlay */}
      {fullscreenCountdown !== null && !isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-midnight/95 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
            <h2 className="text-2xl font-display text-brand mb-2">Fullscreen Required</h2>
            <p className="text-brand/50 mb-6">
              You left fullscreen. Re-enter within {fullscreenCountdown} seconds or your quiz will be auto-submitted.
            </p>
            <div className="mb-6">
              <div className="text-5xl font-mono font-bold text-yellow-400">
                {fullscreenCountdown}
              </div>
            </div>
            <button
              onClick={enterFullscreen}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 btn-ice rounded-lg text-lg"
            >
              <Maximize className="w-5 h-5" />
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {/* Quiz Questions */}
          {questions.map((q, index) => (
            <QuizQuestion
              key={q.id}
              question={q}
              index={index}
              answer={answers[q.id]}
              onAnswerChange={handleAnswerChange}
            />
          ))}

          {/* Outline Fields */}
          {outlineFields.length > 0 && (
            <>
              <div className="pt-6">
                <h2 className="text-xl font-semibold text-brand mb-2">Reflection Questions</h2>
                <p className="text-brand/50">Answer the following questions about your paper.</p>
              </div>

              {outlineFields.map((field, index) => (
                <div key={index} className="glass-card rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-brand-dark/20 text-brand-dark rounded-full font-semibold text-sm">
                      R{index + 1}
                    </span>
                    <p className="text-white flex-1">{field.label}</p>
                    {outlineResponses[field.label] && (
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="ml-12">
                    <textarea
                      value={outlineResponses[field.label] || ''}
                      onChange={(e) =>
                        setOutlineResponses({
                          ...outlineResponses,
                          [field.label]: e.target.value,
                        })
                      }
                      placeholder="Type your response..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-surface-light border border-brand/15 text-white placeholder-brand/30 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Submit Button */}
          <div className="pt-6">
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="w-full px-6 py-4 btn-ice rounded-lg disabled:opacity-50 text-lg"
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
